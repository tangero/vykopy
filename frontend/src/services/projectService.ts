import type { Project } from '../types';
import type { Geometry } from 'geojson';

// Mock API service for projects
// In a real application, this would make HTTP requests to the backend

export interface CreateProjectRequest {
  name: string;
  applicant_organization?: string;
  contractor_organization?: string;
  contractor_contact?: {
    name: string;
    phone: string;
    email: string;
  };
  start_date: string;
  end_date: string;
  geometry: Geometry;
  work_type: string;
  work_category: string;
  description?: string;
  affected_municipalities?: string[];
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  id: string;
  state?: Project['state'];
}

export interface ProjectsResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

class ProjectService {

  // Create a new project (draft or submitted)
  async createProject(data: CreateProjectRequest, isDraft = false): Promise<Project> {
    // Mock implementation - replace with actual API call
    console.log('Creating project:', { data, isDraft });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const project: Project = {
      id: `project-${Date.now()}`,
      name: data.name,
      applicant_id: 'current-user-id', // This would come from auth context
      contractor_organization: data.contractor_organization,
      contractor_contact: data.contractor_contact,
      state: isDraft ? 'draft' : 'pending_approval',
      start_date: data.start_date,
      end_date: data.end_date,
      geometry: data.geometry,
      work_type: data.work_type,
      work_category: data.work_category,
      description: data.description,
      has_conflict: false,
      conflicting_project_ids: [],
      affected_municipalities: data.affected_municipalities || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in localStorage for demo purposes
    const existingProjects = this.getStoredProjects();
    existingProjects.push(project);
    localStorage.setItem('digikop_projects', JSON.stringify(existingProjects));

    return project;
  }

  // Update an existing project
  async updateProject(data: UpdateProjectRequest, isDraft = false): Promise<Project> {
    console.log('Updating project:', { data, isDraft });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const existingProjects = this.getStoredProjects();
    const projectIndex = existingProjects.findIndex(p => p.id === data.id);
    
    if (projectIndex === -1) {
      throw new Error('Project not found');
    }

    const updatedProject: Project = {
      ...existingProjects[projectIndex],
      ...data,
      state: isDraft ? 'draft' : (data.state || existingProjects[projectIndex].state),
      updated_at: new Date().toISOString()
    };

    existingProjects[projectIndex] = updatedProject;
    localStorage.setItem('digikop_projects', JSON.stringify(existingProjects));

    return updatedProject;
  }

  // Get a project by ID
  async getProject(id: string): Promise<Project | null> {
    const existingProjects = this.getStoredProjects();
    return existingProjects.find(p => p.id === id) || null;
  }

  // Get all projects with filtering
  async getProjects(filters?: {
    state?: string[];
    applicant_id?: string;
    page?: number;
    limit?: number;
  }): Promise<ProjectsResponse> {
    let projects = this.getStoredProjects();

    // Apply filters
    if (filters?.state && filters.state.length > 0) {
      projects = projects.filter(p => filters.state!.includes(p.state));
    }

    if (filters?.applicant_id) {
      projects = projects.filter(p => p.applicant_id === filters.applicant_id);
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProjects = projects.slice(startIndex, endIndex);

    return {
      projects: paginatedProjects,
      total: projects.length,
      page,
      limit
    };
  }

  // Delete a project
  async deleteProject(id: string): Promise<void> {
    const existingProjects = this.getStoredProjects();
    const filteredProjects = existingProjects.filter(p => p.id !== id);
    localStorage.setItem('digikop_projects', JSON.stringify(filteredProjects));
  }

  // Submit a draft project for approval
  async submitProject(id: string): Promise<Project> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.state !== 'draft') {
      throw new Error('Only draft projects can be submitted');
    }

    return this.updateProject({
      id,
      state: 'pending_approval'
    });
  }

  // Get user's draft projects
  async getDraftProjects(applicantId?: string): Promise<Project[]> {
    const response = await this.getProjects({
      state: ['draft'],
      applicant_id: applicantId
    });
    return response.projects;
  }

  private getStoredProjects(): Project[] {
    try {
      const stored = localStorage.getItem('digikop_projects');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading stored projects:', error);
      return [];
    }
  }
}

export const projectService = new ProjectService();