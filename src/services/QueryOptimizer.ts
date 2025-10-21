import { Pool } from 'pg';

export class QueryOptimizer {
  constructor(private db: Pool) {}

  /**
   * Analyzes and optimizes PostGIS queries with EXPLAIN ANALYZE
   */
  async analyzeQuery(query: string, params: any[] = []): Promise<{
    executionTime: number;
    planningTime: number;
    totalTime: number;
    suggestions: string[];
  }> {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    
    try {
      const result = await this.db.query(explainQuery, params);
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      const executionTime = plan['Execution Time'];
      const planningTime = plan['Planning Time'];
      const totalTime = executionTime + planningTime;
      
      const suggestions = this.generateOptimizationSuggestions(plan);
      
      return {
        executionTime,
        planningTime,
        totalTime,
        suggestions
      };
    } catch (error) {
      console.error('Query analysis failed:', error);
      throw new Error('Failed to analyze query performance');
    }
  }

  /**
   * Generates optimization suggestions based on query plan
   */
  private generateOptimizationSuggestions(plan: any): string[] {
    const suggestions: string[] = [];
    
    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      suggestions.push('Consider adding indexes for columns used in WHERE clauses');
    }
    
    // Check for expensive spatial operations
    if (this.hasExpensiveSpatialOps(plan)) {
      suggestions.push('Consider using spatial indexes (GIST) for geometry columns');
      suggestions.push('Use ST_DWithin instead of ST_Distance for proximity queries');
    }
    
    // Check for large result sets
    if (plan['Actual Rows'] > 1000) {
      suggestions.push('Consider adding LIMIT clause or pagination for large result sets');
    }
    
    // Check for expensive sorts
    if (this.hasExpensiveSort(plan)) {
      suggestions.push('Consider adding indexes for ORDER BY columns');
    }
    
    return suggestions;
  }

  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') return true;
    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasSequentialScan(subPlan));
    }
    return false;
  }

  private hasExpensiveSpatialOps(plan: any): boolean {
    const spatialFunctions = ['ST_DWithin', 'ST_Intersects', 'ST_Contains', 'ST_Distance'];
    const planText = JSON.stringify(plan);
    return spatialFunctions.some(func => planText.includes(func));
  }

  private hasExpensiveSort(plan: any): boolean {
    if (plan['Node Type'] === 'Sort' && plan['Actual Total Time'] > 100) return true;
    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasExpensiveSort(subPlan));
    }
    return false;
  }

  /**
   * Creates optimized spatial indexes
   */
  async createSpatialIndexes(): Promise<void> {
    const indexes = [
      // Spatial indexes for geometry columns
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_geometry_gist ON projects USING GIST(geometry)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moratoriums_geometry_gist ON moratoriums USING GIST(geometry)',
      
      // Composite indexes for common query patterns
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_state_dates ON projects(state, start_date, end_date)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_applicant_state ON projects(applicant_id, state)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_municipalities ON projects USING GIN(affected_municipalities)',
      
      // Indexes for moratoriums
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moratoriums_dates ON moratoriums(valid_from, valid_to)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_moratoriums_municipality ON moratoriums(municipality_code)',
      
      // Indexes for comments and audit logs
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_comments_project_id ON project_comments(project_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
      
      // Partial indexes for active records
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(role) WHERE is_active = true',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_active ON projects(state, created_at) WHERE state NOT IN (\'completed\', \'cancelled\', \'rejected\')'
    ];

    for (const indexQuery of indexes) {
      try {
        console.log(`Creating index: ${indexQuery}`);
        await this.db.query(indexQuery);
        console.log('Index created successfully');
      } catch (error: any) {
        if (error.code === '42P07') {
          console.log('Index already exists, skipping');
        } else {
          console.error('Failed to create index:', error);
        }
      }
    }
  }

  /**
   * Optimizes database configuration for spatial queries
   */
  async optimizeDatabaseConfig(): Promise<void> {
    const optimizations = [
      // Increase work_mem for complex spatial queries
      'SET work_mem = \'256MB\'',
      
      // Optimize for spatial operations
      'SET random_page_cost = 1.1',
      'SET effective_cache_size = \'1GB\'',
      
      // Enable parallel query execution
      'SET max_parallel_workers_per_gather = 2',
      'SET parallel_tuple_cost = 0.1',
      'SET parallel_setup_cost = 1000'
    ];

    for (const config of optimizations) {
      try {
        await this.db.query(config);
        console.log(`Applied configuration: ${config}`);
      } catch (error) {
        console.warn(`Failed to apply configuration: ${config}`, error);
      }
    }
  }

  /**
   * Analyzes table statistics and suggests maintenance
   */
  async analyzeTableStatistics(): Promise<{
    tables: Array<{
      tableName: string;
      rowCount: number;
      tableSize: string;
      indexSize: string;
      lastAnalyze: Date | null;
      suggestions: string[];
    }>;
  }> {
    const query = `
      SELECT 
        schemaname,
        tablename,
        n_tup_ins + n_tup_upd + n_tup_del as total_operations,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        last_analyze,
        last_autoanalyze,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        (SELECT reltuples::bigint FROM pg_class WHERE relname = tablename) as row_count
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY total_operations DESC
    `;

    const result = await this.db.query(query);
    
    const tables = result.rows.map(row => {
      const suggestions: string[] = [];
      
      // Check if table needs ANALYZE
      const lastAnalyze = row.last_analyze || row.last_autoanalyze;
      if (!lastAnalyze || (Date.now() - new Date(lastAnalyze).getTime()) > 7 * 24 * 60 * 60 * 1000) {
        suggestions.push('Run ANALYZE to update table statistics');
      }
      
      // Check for high update/delete ratio
      const updateDeleteRatio = (row.updates + row.deletes) / Math.max(row.total_operations, 1);
      if (updateDeleteRatio > 0.3) {
        suggestions.push('Consider running VACUUM to reclaim space');
      }
      
      // Check for large tables without recent maintenance
      if (row.row_count > 10000 && suggestions.length > 0) {
        suggestions.push('Schedule regular maintenance for this large table');
      }
      
      return {
        tableName: row.tablename,
        rowCount: parseInt(row.row_count) || 0,
        tableSize: row.table_size,
        indexSize: row.index_size,
        lastAnalyze: lastAnalyze ? new Date(lastAnalyze) : null,
        suggestions
      };
    });

    return { tables };
  }

  /**
   * Runs maintenance tasks to optimize database performance
   */
  async runMaintenance(): Promise<void> {
    const maintenanceTasks = [
      'ANALYZE projects',
      'ANALYZE moratoriums', 
      'ANALYZE users',
      'ANALYZE project_comments',
      'ANALYZE audit_logs',
      'VACUUM ANALYZE projects',
      'VACUUM ANALYZE moratoriums'
    ];

    for (const task of maintenanceTasks) {
      try {
        console.log(`Running maintenance: ${task}`);
        await this.db.query(task);
        console.log('Maintenance task completed');
      } catch (error) {
        console.error(`Maintenance task failed: ${task}`, error);
      }
    }
  }
}