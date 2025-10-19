import { pool } from '../config/database';
import bcrypt from 'bcrypt';
import { config } from '../config';
import { User, UserRole, UserTerritory } from '../types';

export class UserModel {
  // Create a new user
  static async create(userData: {
    email: string;
    password: string;
    name: string;
    organization?: string;
    role?: UserRole;
  }): Promise<User> {
    const client = await pool.connect();
    
    try {
      // Hash password with bcrypt
      const passwordHash = await bcrypt.hash(userData.password, config.bcrypt.rounds);
      
      const query = `
        INSERT INTO users (email, password_hash, name, organization, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, organization, role, is_active, created_at, updated_at
      `;
      
      const values = [
        userData.email,
        passwordHash,
        userData.name,
        userData.organization || null,
        userData.role || 'applicant'
      ];
      
      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Find user by email
  static async findByEmail(email: string): Promise<User | null> {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, password_hash, name, organization, role, is_active, created_at, updated_at
        FROM users 
        WHERE email = $1 AND is_active = true
      `;
      
      const result = await client.query(query, [email]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  // Find user by ID
  static async findById(id: string): Promise<User | null> {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT id, email, name, organization, role, is_active, created_at, updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await client.query(query, [id]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  // Verify password
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user
  static async update(id: string, updates: {
    name?: string;
    organization?: string;
    role?: UserRole;
    isActive?: boolean;
  }): Promise<User | null> {
    const client = await pool.connect();
    
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      
      if (updates.organization !== undefined) {
        fields.push(`organization = $${paramCount++}`);
        values.push(updates.organization);
      }
      
      if (updates.role !== undefined) {
        fields.push(`role = $${paramCount++}`);
        values.push(updates.role);
      }
      
      if (updates.isActive !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(updates.isActive);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      
      const query = `
        UPDATE users 
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING id, email, name, organization, role, is_active, created_at, updated_at
      `;
      
      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  // Get all users (for admin)
  static async findAll(filters?: {
    role?: UserRole;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }> {
    const client = await pool.connect();
    
    try {
      const conditions = [];
      const values = [];
      let paramCount = 1;

      if (filters?.role) {
        conditions.push(`role = $${paramCount++}`);
        values.push(filters.role);
      }
      
      if (filters?.isActive !== undefined) {
        conditions.push(`is_active = $${paramCount++}`);
        values.push(filters.isActive);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Count total
      const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get paginated results
      const page = filters?.page || 1;
      const limit = filters?.limit || 20;
      const offset = (page - 1) * limit;

      const query = `
        SELECT id, email, name, organization, role, is_active, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;
      
      values.push(limit, offset);
      const result = await client.query(query, values);
      
      return {
        users: result.rows,
        total
      };
    } finally {
      client.release();
    }
  }

  // Delete user (soft delete)
  static async delete(id: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const query = `
        UPDATE users 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `;
      
      const result = await client.query(query, [id]);
      return (result.rowCount || 0) > 0;
    } finally {
      client.release();
    }
  }

  // Get user territories
  static async getUserTerritories(userId: string): Promise<UserTerritory[]> {
    const client = await pool.connect();
    
    try {
      const query = `
        SELECT user_id, municipality_code, municipality_name
        FROM user_territories 
        WHERE user_id = $1
        ORDER BY municipality_name
      `;
      
      const result = await client.query(query, [userId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Assign territories to user
  static async assignTerritories(userId: string, territories: Omit<UserTerritory, 'userId'>[]): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Remove existing territories
      await client.query('DELETE FROM user_territories WHERE user_id = $1', [userId]);
      
      // Add new territories
      if (territories.length > 0) {
        const values = territories.map((territory, index) => 
          `($1, $${index * 2 + 2}, $${index * 2 + 3})`
        ).join(', ');
        
        const params = [userId];
        territories.forEach(territory => {
          params.push(territory.municipalityCode, territory.municipalityName);
        });
        
        const query = `
          INSERT INTO user_territories (user_id, municipality_code, municipality_name)
          VALUES ${values}
        `;
        
        await client.query(query, params);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Check if user has access to municipality
  static async hasAccessToMunicipality(userId: string, municipalityCode: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      // Regional admins have access to everything
      const userQuery = `SELECT role FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      
      if (!userResult.rows[0]) {
        return false;
      }
      
      if (userResult.rows[0].role === 'regional_admin') {
        return true;
      }
      
      // Check territorial access for municipal coordinators
      if (userResult.rows[0].role === 'municipal_coordinator') {
        const territoryQuery = `
          SELECT 1 FROM user_territories 
          WHERE user_id = $1 AND municipality_code = $2
        `;
        const territoryResult = await client.query(territoryQuery, [userId, municipalityCode]);
        return territoryResult.rows.length > 0;
      }
      
      // Applicants don't have territorial restrictions for viewing
      return true;
    } finally {
      client.release();
    }
  }
}