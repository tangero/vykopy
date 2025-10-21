import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { Project } from '../types';
import { projectService } from '../services/projectService';
import { mockProjects } from '../data/mockProjects';
import ProjectComments from './ProjectComments';
import ProjectHistory from './ProjectHistory';
import './ProjectDetail.css';



interface ProjectHistoryEntry {
  id: string;
  action: string;
  user_name: string;
  user_role: string;
  old_values?: any;
  new_values?: any;
  created_at: string;
  description: string;
}

interface ProjectDetailProps {
  projectId: string;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projectId }) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<ProjectHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      
      // Try to load from service first
      let projectData = await projectService.getProject(projectId);
      
      // If not found, try mock data
      if (!projectData) {
        const mockProject = mockProjects.find(mp => mp.id === projectId);
        if (mockProject) {
          projectData = {
            id: mockProject.id,
            name: mockProject.name,
            applicant_id: 'mock-user',
            state: mockProject.state as Project['state'],
            start_date: mockProject.properties.startDate,
            end_date: mockProject.properties.endDate,
            geometry: mockProject.geometry,
            work_type: mockProject.properties.workType,
            work_category: 'general',
            has_conflict: Math.random() > 0.8,
            conflicting_project_ids: [],
            affected_municipalities: ['Praha'],
            created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            contractor_organization: mockProject.properties.contractor,
            description: mockProject.properties.description
          };
        }
      }

      if (projectData) {
        setProject(projectData);
        loadHistory(projectId);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };



  const loadHistory = async (_projectId: string) => {
    // Mock history data
    const mockHistory: ProjectHistoryEntry[] = [
      {
        id: '1',
        action: 'create',
        user_name: 'Marie Svobodová',
        user_role: 'applicant',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Projekt byl vytvořen'
      },
      {
        id: '2',
        action: 'state_change',
        user_name: 'Marie Svobodová',
        user_role: 'applicant',
        old_values: { state: 'draft' },
        new_values: { state: 'pending_approval' },
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Projekt byl odeslán ke schválení'
      },
      {
        id: '3',
        action: 'update',
        user_name: 'Marie Svobodová',
        user_role: 'applicant',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Aktualizace popisu projektu'
      }
    ];
    setHistory(mockHistory);
  };



  const handleApproveProject = async () => {
    if (!project) return;
    
    try {
      await projectService.updateProject({
        id: project.id,
        state: 'approved'
      });
      await loadProjectData();
    } catch (error) {
      console.error('Error approving project:', error);
    }
  };

  const handleRejectProject = async () => {
    if (!project) return;
    
    const reason = window.prompt('Důvod zamítnutí:');
    if (!reason) return;

    try {
      await projectService.updateProject({
        id: project.id,
        state: 'rejected'
      });
      
      // TODO: Add rejection comment via API
      
      await loadProjectData();
    } catch (error) {
      console.error('Error rejecting project:', error);
    }
  };

  if (loading) {
    return (
      <div className="project-detail loading">
        <div className="loading-spinner">Načítání...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail">
        <div className="error-message">Projekt nebyl nalezen.</div>
      </div>
    );
  }
  const getStateDisplayName = (state: Project['state']) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('cs-CZ');
  };

  const getRoleLabel = (role: string) => {
    const labels = {
      regional_admin: 'Regionální administrátor',
      municipal_coordinator: 'Koordinátor obce',
      applicant: 'Žadatel'
    };
    return labels[role as keyof typeof labels] || role;
  };

  const canApprove = () => {
    return user?.role === 'municipal_coordinator' || user?.role === 'regional_admin';
  };

  const canEdit = () => {
    return project?.applicant_id === user?.id && 
           (project?.state === 'draft' || project?.state === 'rejected');
  };



  return (
    <div className="project-detail">
      <div className="project-detail-header">
        <h2>{project.name}</h2>
        <div 
          className="project-status"
          style={{ backgroundColor: getStateColor(project.state) }}
        >
          {getStateDisplayName(project.state)}
        </div>
      </div>

      {project.has_conflict && (
        <div className="conflict-alert">
          ⚠️ Tento projekt má detekované konflikty s jinými projekty
        </div>
      )}

      {/* Tab Navigation */}
      <div className="detail-tabs">
        <button 
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Detail projektu
        </button>
        <button 
          className={`tab-button ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Komentáře
        </button>
        <button 
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Historie ({history.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'details' && (
          <div className="details-tab">
            <div className="project-detail-section">
              <h3>Základní informace</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>ID projektu:</label>
                  <span>{project.id}</span>
                </div>
                <div className="detail-item">
                  <label>Typ práce:</label>
                  <span>{project.work_type}</span>
                </div>
                <div className="detail-item">
                  <label>Kategorie:</label>
                  <span>{project.work_category}</span>
                </div>
                <div className="detail-item">
                  <label>Zhotovitel:</label>
                  <span>{project.contractor_organization || 'Nezadáno'}</span>
                </div>
                <div className="detail-item">
                  <label>Dotčené obce:</label>
                  <span>{project.affected_municipalities.join(', ') || 'Nezadáno'}</span>
                </div>
              </div>
            </div>

            <div className="project-detail-section">
              <h3>Časový rámec</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Začátek prací:</label>
                  <span>{formatDate(project.start_date)}</span>
                </div>
                <div className="detail-item">
                  <label>Konec prací:</label>
                  <span>{formatDate(project.end_date)}</span>
                </div>
                <div className="detail-item">
                  <label>Vytvořeno:</label>
                  <span>{formatDateTime(project.created_at)}</span>
                </div>
                <div className="detail-item">
                  <label>Poslední změna:</label>
                  <span>{formatDateTime(project.updated_at)}</span>
                </div>
              </div>
            </div>

            {project.contractor_contact && (
              <div className="project-detail-section">
                <h3>Kontakt na zhotovitele</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Jméno:</label>
                    <span>{project.contractor_contact.name}</span>
                  </div>
                  <div className="detail-item">
                    <label>Telefon:</label>
                    <span>{project.contractor_contact.phone}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{project.contractor_contact.email}</span>
                  </div>
                </div>
              </div>
            )}

            {project.description && (
              <div className="project-detail-section">
                <h3>Popis projektu</h3>
                <p>{project.description}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <ProjectComments projectId={projectId} />
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            <div className="history-header">
              <h3>Historie změn</h3>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowHistoryModal(true)}
              >
                📋 Zobrazit úplnou historii
              </button>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty-state">
                  <p>Zatím nejsou žádné záznamy v historii.</p>
                </div>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className="history-item">
                    <div className="history-icon">
                      {entry.action === 'create' && '➕'}
                      {entry.action === 'update' && '✏️'}
                      {entry.action === 'state_change' && '🔄'}
                      {entry.action === 'delete' && '🗑️'}
                    </div>
                    <div className="history-content">
                      <div className="history-description">
                        {entry.description}
                      </div>
                      <div className="history-meta">
                        <span>{entry.user_name} ({getRoleLabel(entry.user_role)})</span>
                        <span>{formatDateTime(entry.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="project-detail-actions">
        {canEdit() && (
          <button className="btn-edit">
            ✏️ Upravit projekt
          </button>
        )}

        {canApprove() && project.state === 'pending_approval' && (
          <>
            <button className="btn-approve" onClick={handleApproveProject}>
              ✅ Schválit
            </button>
            <button className="btn-reject" onClick={handleRejectProject}>
              ❌ Zamítnout
            </button>
          </>
        )}

        <button className="btn-map">
          🗺️ Zobrazit na mapě
        </button>

        {project.state === 'approved' && project.applicant_id === user?.id && (
          <button className="btn-start">
            🚧 Zahájit práce
          </button>
        )}
      </div>

      {/* Project History Modal */}
      <ProjectHistory
        projectId={projectId}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  );
};

export default ProjectDetail;