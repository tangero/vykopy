import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { Project } from '../types';
import { projectService } from '../services/projectService';
import { mockProjects } from '../data/mockProjects';
import './ApplicantProjectList.css';

interface ProjectFilters {
  state: string[];
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const ApplicantProjectList: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ProjectFilters>({
    state: [],
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [projects, filters]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      
      // Load user's projects
      const response = await projectService.getProjects({
        applicant_id: user?.id,
        limit: 100
      });
      
      // Add mock projects for demonstration (filtered by current user)
      const mockUserProjects = mockProjects.map(mp => ({
        id: mp.id,
        name: mp.name,
        applicant_id: user?.id || 'current-user',
        state: mp.state as Project['state'],
        start_date: mp.properties.startDate,
        end_date: mp.properties.endDate,
        geometry: mp.geometry,
        work_type: mp.properties.workType,
        work_category: 'general',
        has_conflict: Math.random() > 0.8, // Random conflicts for demo
        conflicting_project_ids: [],
        affected_municipalities: ['Praha'],
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        contractor_organization: mp.properties.contractor,
        description: mp.properties.description
      }));

      const allProjects = [...response.projects, ...mockUserProjects];
      setProjects(allProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...projects];

    // Filter by state
    if (filters.state.length > 0) {
      filtered = filtered.filter(project => filters.state.includes(project.state));
    }

    // Filter by date range
    if (filters.dateFrom) {
      filtered = filtered.filter(project => 
        new Date(project.start_date) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(project => 
        new Date(project.end_date) <= new Date(filters.dateTo)
      );
    }

    // Filter by search term
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(searchLower) ||
        project.work_type.toLowerCase().includes(searchLower) ||
        (project.contractor_organization?.toLowerCase().includes(searchLower)) ||
        (project.description?.toLowerCase().includes(searchLower))
      );
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setFilteredProjects(filtered);
  };

  const handleFilterChange = (key: keyof ProjectFilters, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleStateFilterToggle = (state: string) => {
    setFilters(prev => ({
      ...prev,
      state: prev.state.includes(state)
        ? prev.state.filter(s => s !== state)
        : [...prev.state, state]
    }));
  };

  const handleEditProject = (projectId: string) => {
    console.log('Edit project:', projectId);
    // TODO: Navigate to edit form or open edit modal
  };

  const handleDuplicateProject = async (project: Project) => {
    try {
      const duplicatedProject = {
        name: `${project.name} (kopie)`,
        contractor_organization: project.contractor_organization,
        contractor_contact: project.contractor_contact,
        start_date: project.start_date,
        end_date: project.end_date,
        geometry: project.geometry,
        work_type: project.work_type,
        work_category: project.work_category,
        description: project.description,
        affected_municipalities: project.affected_municipalities
      };

      await projectService.createProject(duplicatedProject, true); // Create as draft
      await loadProjects(); // Reload projects
    } catch (error) {
      console.error('Error duplicating project:', error);
    }
  };

  const handleCancelProject = async (projectId: string) => {
    if (window.confirm('Opravdu chcete zrušit tento projekt?')) {
      try {
        await projectService.updateProject({
          id: projectId,
          state: 'cancelled'
        });
        await loadProjects(); // Reload projects
      } catch (error) {
        console.error('Error cancelling project:', error);
      }
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Opravdu chcete smazat tento projekt? Tato akce je nevratná.')) {
      try {
        await projectService.deleteProject(projectId);
        await loadProjects(); // Reload projects
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  const getStateLabel = (state: Project['state']) => {
    const labels = {
      draft: 'Koncept',
      forward_planning: 'Předběžné plánování',
      pending_approval: 'Čeká na schválení',
      approved: 'Schváleno',
      in_progress: 'Probíhá',
      completed: 'Dokončeno',
      rejected: 'Zamítnuto',
      cancelled: 'Zrušeno'
    };
    return labels[state] || state;
  };

  const getStateColor = (state: Project['state']) => {
    const colors = {
      draft: '#6b7280',
      forward_planning: '#3b82f6',
      pending_approval: '#f59e0b',
      approved: '#10b981',
      in_progress: '#ef4444',
      completed: '#6b7280',
      rejected: '#ef4444',
      cancelled: '#6b7280'
    };
    return colors[state] || '#6b7280';
  };

  const canEdit = (project: Project) => {
    return project.state === 'draft' || project.state === 'rejected';
  };

  const canCancel = (project: Project) => {
    return ['pending_approval', 'approved'].includes(project.state);
  };

  const canDelete = (project: Project) => {
    return project.state === 'draft';
  };

  if (loading) {
    return (
      <div className="applicant-project-list loading">
        <div className="loading-spinner">Načítání projektů...</div>
      </div>
    );
  }

  return (
    <div className="applicant-project-list">
      <div className="list-header">
        <h1>Moje projekty</h1>
        <p>Přehled všech vašich projektů výkopových prací</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Hledat v projektech..."
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            className="search-input"
          />
        </div>

        <div className="date-filters">
          <div className="date-filter">
            <label>Od:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="date-filter">
            <label>Do:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </div>

        <div className="state-filters">
          <span className="filter-label">Stav:</span>
          {['draft', 'pending_approval', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled'].map(state => (
            <label key={state} className="state-filter-checkbox">
              <input
                type="checkbox"
                checked={filters.state.includes(state)}
                onChange={() => handleStateFilterToggle(state)}
              />
              <span>{getStateLabel(state as Project['state'])}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="projects-section">
        <div className="projects-header">
          <h2>Projekty ({filteredProjects.length})</h2>
          <button className="btn-new-project">+ Nový projekt</button>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            {projects.length === 0 ? (
              <div>
                <p>Zatím nemáte žádné projekty.</p>
                <button className="btn-new-project">Vytvořit první projekt</button>
              </div>
            ) : (
              <p>Žádné projekty nevyhovují zadaným filtrům.</p>
            )}
          </div>
        ) : (
          <div className="projects-table">
            <div className="table-header">
              <div className="col-name">Název projektu</div>
              <div className="col-state">Stav</div>
              <div className="col-dates">Termín</div>
              <div className="col-type">Typ práce</div>
              <div className="col-actions">Akce</div>
            </div>

            {filteredProjects.map(project => (
              <div key={project.id} className="table-row">
                <div className="col-name">
                  <div className="project-name">{project.name}</div>
                  <div className="project-contractor">{project.contractor_organization || 'Nezadáno'}</div>
                  {project.has_conflict && (
                    <div className="conflict-indicator">⚠️ Konflikt</div>
                  )}
                </div>

                <div className="col-state">
                  <span 
                    className="state-badge"
                    style={{ backgroundColor: getStateColor(project.state) }}
                  >
                    {getStateLabel(project.state)}
                  </span>
                </div>

                <div className="col-dates">
                  <div>{formatDate(project.start_date)}</div>
                  <div className="end-date">{formatDate(project.end_date)}</div>
                </div>

                <div className="col-type">
                  {project.work_type}
                </div>

                <div className="col-actions">
                  <div className="action-buttons">
                    <button 
                      className="btn-view"
                      title="Zobrazit detail"
                    >
                      👁️
                    </button>

                    {canEdit(project) && (
                      <button 
                        className="btn-edit"
                        onClick={() => handleEditProject(project.id)}
                        title="Upravit"
                      >
                        ✏️
                      </button>
                    )}

                    <button 
                      className="btn-duplicate"
                      onClick={() => handleDuplicateProject(project)}
                      title="Duplikovat"
                    >
                      📋
                    </button>

                    {canCancel(project) && (
                      <button 
                        className="btn-cancel"
                        onClick={() => handleCancelProject(project.id)}
                        title="Zrušit"
                      >
                        ❌
                      </button>
                    )}

                    {canDelete(project) && (
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteProject(project.id)}
                        title="Smazat"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicantProjectList;