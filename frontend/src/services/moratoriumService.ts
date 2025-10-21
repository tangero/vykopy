import type { Moratorium } from '../types';
import type { Geometry } from 'geojson';

export interface CreateMoratoriumRequest {
  name: string;
  geometry: Geometry;
  reason: string;
  reasonDetail?: string;
  validFrom: string;
  validTo: string;
  exceptions?: string;
  municipalityCode: string;
}

export interface UpdateMoratoriumRequest extends Partial<CreateMoratoriumRequest> {
  id: string;
}

export interface MoratoriumsResponse {
  moratoriums: Moratorium[];
  total: number;
  page: number;
  limit: number;
}

class MoratoriumService {
  private baseUrl = '/api/moratoriums';

  // Create a new moratorium
  async createMoratorium(data: CreateMoratoriumRequest): Promise<Moratorium> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create moratorium');
    }

    const result = await response.json();
    return result.data.moratorium;
  }

  // Update an existing moratorium
  async updateMoratorium(data: UpdateMoratoriumRequest): Promise<Moratorium> {
    const { id, ...updateData } = data;
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update moratorium');
    }

    const result = await response.json();
    return result.data.moratorium;
  }

  // Get a moratorium by ID
  async getMoratorium(id: string): Promise<Moratorium | null> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch moratorium');
    }

    const result = await response.json();
    return result.data.moratorium;
  }

  // Get all moratoriums with filtering
  async getMoratoriums(filters?: {
    municipalityCode?: string;
    activeOnly?: boolean;
    validFrom?: string;
    validTo?: string;
    page?: number;
    limit?: number;
  }): Promise<MoratoriumsResponse> {
    const params = new URLSearchParams();
    
    if (filters?.municipalityCode) params.append('municipalityCode', filters.municipalityCode);
    if (filters?.activeOnly) params.append('activeOnly', 'true');
    if (filters?.validFrom) params.append('validFrom', filters.validFrom);
    if (filters?.validTo) params.append('validTo', filters.validTo);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${this.baseUrl}?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch moratoriums');
    }

    const result = await response.json();
    return {
      moratoriums: result.data.moratoriums,
      total: result.data.pagination.total,
      page: result.data.pagination.page,
      limit: result.data.pagination.limit
    };
  }

  // Get active moratoriums
  async getActiveMoratoriums(municipalityCode?: string): Promise<Moratorium[]> {
    const params = new URLSearchParams();
    if (municipalityCode) params.append('municipalityCode', municipalityCode);

    const response = await fetch(`${this.baseUrl}/active?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch active moratoriums');
    }

    const result = await response.json();
    return result.data.moratoriums;
  }

  // Delete a moratorium
  async deleteMoratorium(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete moratorium');
    }
  }

  // Get moratorium statistics for a municipality
  async getMoratoriumStatistics(municipalityCode: string): Promise<{
    total: number;
    active: number;
    expiringSoon: number;
    totalArea: number;
  }> {
    const response = await fetch(`${this.baseUrl}/municipality/${municipalityCode}/statistics`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch moratorium statistics');
    }

    const result = await response.json();
    return result.data.statistics;
  }

  // Check if a project violates any moratoriums
  async checkProjectViolations(
    geometry: Geometry,
    startDate: string,
    endDate: string,
    municipalityCodes?: string[]
  ): Promise<{
    violations: Moratorium[];
    warnings: string[];
    canProceed: boolean;
  }> {
    const params = new URLSearchParams();
    params.append('geometry', JSON.stringify(geometry));
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    
    if (municipalityCodes && municipalityCodes.length > 0) {
      params.append('municipalityCodes', municipalityCodes.join(','));
    }

    const response = await fetch(`${this.baseUrl}/check-violations?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to check moratorium violations');
    }

    const result = await response.json();
    return result.data;
  }

  // Allow coordinator to approve project despite moratorium (creates exception)
  async approveProjectWithMoratoriumException(
    projectId: string,
    moratoriumId: string,
    reason: string
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${moratoriumId}/exceptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAuthToken()}`
      },
      body: JSON.stringify({
        projectId,
        reason,
        approvedBy: 'current-user-id' // This would come from auth context
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to approve moratorium exception');
    }
  }

  private getAuthToken(): string {
    // This would typically get the token from your auth context/store
    return localStorage.getItem('auth_token') || '';
  }
}

export const moratoriumService = new MoratoriumService();