import type { Geometry } from 'geojson';
import type { Project, Moratorium } from '../types';

export interface ConflictDetectionResult {
  hasConflict: boolean;
  spatialConflicts: Project[];
  temporalConflicts: Project[];
  moratoriumViolations: Moratorium[];
  summary: {
    totalConflicts: number;
    criticalConflicts: number;
    warnings: number;
  };
}

export interface ConflictDetectionRequest {
  geometry: Geometry;
  startDate: string;
  endDate: string;
  excludeProjectId?: string; // Exclude this project from conflict detection (for updates)
}

class ConflictDetectionService {
  // Mock conflict detection - in real app this would call the backend API
  async detectConflicts(request: ConflictDetectionRequest): Promise<ConflictDetectionResult> {
    console.log('Running conflict detection:', request);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock conflict detection logic
    const mockConflicts = this.generateMockConflicts(request);
    
    return mockConflicts;
  }

  private generateMockConflicts(request: ConflictDetectionRequest): ConflictDetectionResult {
    // Mock data - in real app this would come from the backend
    const mockProjects: Project[] = [
      {
        id: 'project-1',
        name: 'Oprava vodovodu - Hlavní ulice',
        applicant_id: 'user-1',
        state: 'approved',
        start_date: '2024-03-15',
        end_date: '2024-03-25',
        geometry: {
          type: 'LineString',
          coordinates: [[14.4378, 50.0755], [14.4380, 50.0757]]
        },
        work_type: 'utility_installation',
        work_category: 'water',
        has_conflict: false,
        conflicting_project_ids: [],
        affected_municipalities: ['Praha'],
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z'
      },
      {
        id: 'project-2',
        name: 'Rekonstrukce chodníku',
        applicant_id: 'user-2',
        state: 'in_progress',
        start_date: '2024-03-20',
        end_date: '2024-04-05',
        geometry: {
          type: 'LineString',
          coordinates: [[14.4379, 50.0756], [14.4381, 50.0758]]
        },
        work_type: 'road_work',
        work_category: 'road_infrastructure',
        has_conflict: false,
        conflicting_project_ids: [],
        affected_municipalities: ['Praha'],
        created_at: '2024-02-01T10:00:00Z',
        updated_at: '2024-02-01T10:00:00Z'
      }
    ];

    const mockMoratoriums: Moratorium[] = [
      {
        id: 'moratorium-1',
        name: 'Zákaz výkopů - Nově opravená silnice',
        geometry: {
          type: 'Polygon',
          coordinates: [[[14.4375, 50.0750], [14.4385, 50.0750], [14.4385, 50.0760], [14.4375, 50.0760], [14.4375, 50.0750]]]
        },
        reason: 'road_reconstruction',
        reasonDetail: 'Silnice byla nedávno opravena',
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-12-31'),
        createdBy: 'admin-1',
        municipalityCode: '554782',
        createdAt: new Date('2024-01-01T10:00:00Z')
      }
    ];

    // Simple mock conflict detection logic
    const spatialConflicts: Project[] = [];
    const temporalConflicts: Project[] = [];
    const moratoriumViolations: Moratorium[] = [];

    // Check for spatial conflicts (simplified - just check if coordinates are close)
    if (request.geometry.type === 'LineString' || request.geometry.type === 'Point') {
      const requestCoords = request.geometry.type === 'Point' 
        ? [request.geometry.coordinates] 
        : request.geometry.coordinates;

      for (const project of mockProjects) {
        if (project.id === request.excludeProjectId) continue;
        
        if (project.geometry.type === 'LineString' || project.geometry.type === 'Point') {
          const projectCoords = project.geometry.type === 'Point'
            ? [project.geometry.coordinates]
            : project.geometry.coordinates;

          // Simple distance check (in real app this would use proper spatial algorithms)
          const isNearby = this.checkProximity(requestCoords, projectCoords);
          
          if (isNearby) {
            spatialConflicts.push(project);
            
            // Check temporal overlap
            const hasTemporalOverlap = this.checkTemporalOverlap(
              request.startDate,
              request.endDate,
              project.start_date,
              project.end_date
            );
            
            if (hasTemporalOverlap) {
              temporalConflicts.push(project);
            }
          }
        }
      }
    }

    // Check moratorium violations
    for (const moratorium of mockMoratoriums) {
      const isInMoratoriumArea = this.checkGeometryIntersection(request.geometry, moratorium.geometry);
      const isInMoratoriumPeriod = this.checkTemporalOverlap(
        request.startDate,
        request.endDate,
        moratorium.validFrom.toISOString().split('T')[0],
        moratorium.validTo.toISOString().split('T')[0]
      );
      
      if (isInMoratoriumArea && isInMoratoriumPeriod) {
        moratoriumViolations.push(moratorium);
      }
    }

    const totalConflicts = spatialConflicts.length + temporalConflicts.length + moratoriumViolations.length;
    const criticalConflicts = temporalConflicts.length + moratoriumViolations.length;
    const warnings = spatialConflicts.length - temporalConflicts.length;

    return {
      hasConflict: totalConflicts > 0,
      spatialConflicts,
      temporalConflicts,
      moratoriumViolations,
      summary: {
        totalConflicts,
        criticalConflicts,
        warnings
      }
    };
  }

  private checkProximity(coords1: number[][], coords2: number[][]): boolean {
    // Simple proximity check - in real app this would use proper spatial calculations
    const threshold = 0.001; // Roughly 100 meters
    
    for (const coord1 of coords1) {
      for (const coord2 of coords2) {
        const distance = Math.sqrt(
          Math.pow(coord1[0] - coord2[0], 2) + Math.pow(coord1[1] - coord2[1], 2)
        );
        if (distance < threshold) {
          return true;
        }
      }
    }
    return false;
  }

  private checkTemporalOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);
    
    return s1 <= e2 && s2 <= e1;
  }

  private checkGeometryIntersection(geom1: Geometry, geom2: Geometry): boolean {
    // Simplified intersection check - in real app this would use proper spatial algorithms
    // For now, just return true if both geometries exist (mock behavior)
    return geom1 && geom2 ? Math.random() > 0.7 : false;
  }
}

export const conflictDetectionService = new ConflictDetectionService();