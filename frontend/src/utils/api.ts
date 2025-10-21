import type { ApiError } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organization?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    organization?: string;
    role: 'regional_admin' | 'municipal_coordinator' | 'applicant';
    territories?: string[];
  };
  token: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json();
        throw new Error(errorData.error.message || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<AuthResponse['user']> {
    return this.request<AuthResponse['user']>('/auth/me');
  }

  async refreshToken(): Promise<{ token: string }> {
    return this.request<{ token: string }>('/auth/refresh', {
      method: 'POST',
    });
  }

  // Generic HTTP methods
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    const config: RequestInit = {
      ...options,
      method: 'POST',
    };

    // Handle FormData (for file uploads)
    if (data instanceof FormData) {
      config.body = data;
      // Remove Content-Type header to let browser set it with boundary
      const headers = { ...config.headers };
      delete (headers as any)['Content-Type'];
      config.headers = headers;
    } else if (data) {
      config.body = JSON.stringify(data);
    }

    return this.request<T>(endpoint, config);
  }

  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

// Export a simple api object for backward compatibility
export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => apiClient.get<T>(endpoint, options),
  post: <T>(endpoint: string, data?: any, options?: RequestInit) => apiClient.post<T>(endpoint, data, options),
  put: <T>(endpoint: string, data?: any, options?: RequestInit) => apiClient.put<T>(endpoint, data, options),
  delete: <T>(endpoint: string, options?: RequestInit) => apiClient.delete<T>(endpoint, options),
};