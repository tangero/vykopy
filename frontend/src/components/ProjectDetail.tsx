import React from 'react';

interface Project {
  id: string;
  name: string;
  applicant: string;
  contractor?: string;
  state: string;
  startDate: string;
  endDate: string;
  workType: string;
  description?: string;
  location: string;
}

interface ProjectDetailProps {
  projectId: string;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projectId }) => {
  // Mock project data for now - will be replaced with API call
  const project: Project = {
    id: projectId,
    name: `Projekt ${projectId}`,
    applicant: 'Město Praha',
    contractor: 'Stavební firma s.r.o.',
    state: 'pending_approval',
    startDate: '2024-03-15',
    endDate: '2024-04-30',
    workType: 'Oprava komunikace',
    description: 'Oprava povrchu vozovky na ulici Hlavní',
    location: 'Praha 1, Hlavní ulice'
  };
  const getStateDisplayName = (state: string) => {
    switch (state) {
      case 'draft':
        return 'Koncept';
      case 'forward_planning':
        return 'Předběžné plánování';
      case 'pending_approval':
        return 'Čeká na schválení';
      case 'approved':
        return 'Schváleno';
      case 'in_progress':
        return 'Probíhá';
      case 'completed':
        return 'Dokončeno';
      case 'rejected':
        return 'Zamítnuto';
      case 'cancelled':
        return 'Zrušeno';
      default:
        return state;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'draft':
        return '#757575';
      case 'forward_planning':
        return '#2196f3';
      case 'pending_approval':
        return '#ff9800';
      case 'approved':
        return '#4caf50';
      case 'in_progress':
        return '#f44336';
      case 'completed':
        return '#9e9e9e';
      case 'rejected':
        return '#d32f2f';
      case 'cancelled':
        return '#616161';
      default:
        return '#757575';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
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

      <div className="project-detail-section">
        <h3>Základní informace</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Žadatel:</label>
            <span>{project.applicant}</span>
          </div>
          {project.contractor && (
            <div className="detail-item">
              <label>Zhotovitel:</label>
              <span>{project.contractor}</span>
            </div>
          )}
          <div className="detail-item">
            <label>Typ práce:</label>
            <span>{project.workType}</span>
          </div>
          <div className="detail-item">
            <label>Lokalita:</label>
            <span>{project.location}</span>
          </div>
        </div>
      </div>

      <div className="project-detail-section">
        <h3>Časový rámec</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <label>Začátek:</label>
            <span>{formatDate(project.startDate)}</span>
          </div>
          <div className="detail-item">
            <label>Konec:</label>
            <span>{formatDate(project.endDate)}</span>
          </div>
        </div>
      </div>

      {project.description && (
        <div className="project-detail-section">
          <h3>Popis</h3>
          <p>{project.description}</p>
        </div>
      )}

      <div className="project-detail-actions">
        <button className="primary">Upravit</button>
        <button className="secondary">Zobrazit na mapě</button>
      </div>
    </div>
  );
};

export default ProjectDetail;