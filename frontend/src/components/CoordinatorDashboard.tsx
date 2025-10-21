import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { Project } from '../types';
import { projectService } from '../services/projectService';
import { mockProjects } from '../data/mockProjects';
import './CoordinatorDashboard.css';

interface DashboardStats {
  pendingApproval: number;
  activeProjects: number;
  conflictsDetected: number;
  completedThisMonth: number;
}

interface RecentActivity {
  id: string;
  type: 'project_submitted' | 'conflict_detected' | 'project_approved' | 'project_completed';
  projectName: string;
  timestamp: string;
  description: string;
}

const CoordinatorDashboard: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DashboardStats>({
    pendingApproval: 0,
    activeProjects: 0,
    conflictsDetected: 0,
    completedThisMonth: 0
  });
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load projects for statistics
      const allProjectsResponse = await projectService.getProjects({ limit: 100 });
      const allProjects = allProjectsResponse.projects;
      
      // Add mock projects for demonstration
      const combinedProjects = [...allProjects, ...mockProjects.map(mp => ({
        id: mp.id,
        name: mp.name,
        applicant_id: 'mock-user',
        state: mp.state as Project['state'],
        start_date: mp.properties.startDate,
        end_date: mp.properties.endDate,
        geometry: mp.geometry,
        work_type: mp.properties.workType,
        work_category: 'general',
        has_conflict: Math.random() > 0.7, // Random conflicts for demo
        conflicting_project_ids: [],
        affected_municipalities: ['Praha'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        contractor_organization: mp.properties.contractor,
        description: mp.properties.description
      }))];

      // Calculate statistics
      const pending = combinedProjects.filter(p => p.state === 'pending_approval');
      const active = combinedProjects.filter(p => 
        p.state === 'approved' || p.state === 'in_progress'
      );
      const conflicts = combinedProjects.filter(p => p.has_conflict);
      
      // Calculate completed this month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const completedThisMonth = combinedProjects.filter(p => {
        if (p.state !== 'completed') return false;
        const completedDate = new Date(p.updated_at);
        return completedDate.getMonth() === currentMonth && 
               completedDate.getFullYear() === currentYear;
      });

      setStats({
        pendingApproval: pending.length,
        activeProjects: active.length,
        conflictsDetected: conflicts.length,
        completedThisMonth: completedThisMonth.length
      });

      setPendingProjects(pending.slice(0, 5)); // Show only first 5

      // Generate recent activities
      const activities: RecentActivity[] = [
        {
          id: '1',
          type: 'project_submitted',
          projectName: 'Rekonstrukce vodovodu - Hlavní ulice',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          description: 'Nový projekt byl odeslán ke schválení'
        },
        {
          id: '2',
          type: 'conflict_detected',
          projectName: 'Oprava plynovodu - Náměstí Míru',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          description: 'Detekován konflikt s existujícím projektem'
        },
        {
          id: '3',
          type: 'project_approved',
          projectName: 'Pokládka optických kabelů',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          description: 'Projekt byl schválen a může začít'
        },
        {
          id: '4',
          type: 'project_completed',
          projectName: 'Oprava kanalizace - Wenceslas Square',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          description: 'Projekt byl úspěšně dokončen'
        }
      ];

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('cs-CZ');
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'project_submitted':
        return '📝';
      case 'conflict_detected':
        return '⚠️';
      case 'project_approved':
        return '✅';
      case 'project_completed':
        return '🏁';
      default:
        return '📋';
    }
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

  if (loading) {
    return (
      <div className="coordinator-dashboard loading">
        <div className="loading-spinner">Načítání...</div>
      </div>
    );
  }

  return (
    <div className="coordinator-dashboard">
      <div className="dashboard-header">
        <h1>Dashboard koordinátora</h1>
        <p>Vítejte, {user?.name}. Zde je přehled aktuální situace ve vašem území.</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-number">{stats.pendingApproval}</div>
            <div className="stat-label">Čeká na schválení</div>
          </div>
        </div>

        <div className="stat-card active">
          <div className="stat-icon">🚧</div>
          <div className="stat-content">
            <div className="stat-number">{stats.activeProjects}</div>
            <div className="stat-label">Aktivní projekty</div>
          </div>
        </div>

        <div className="stat-card conflicts">
          <div className="stat-icon">⚠️</div>
          <div className="stat-content">
            <div className="stat-number">{stats.conflictsDetected}</div>
            <div className="stat-label">Detekované konflikty</div>
          </div>
        </div>

        <div className="stat-card completed">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.completedThisMonth}</div>
            <div className="stat-label">Dokončeno tento měsíc</div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Pending Projects */}
        <div className="dashboard-section">
          <h2>Projekty čekající na schválení</h2>
          {pendingProjects.length === 0 ? (
            <div className="empty-state">
              <p>Žádné projekty nečekají na schválení.</p>
            </div>
          ) : (
            <div className="pending-projects-list">
              {pendingProjects.map(project => (
                <div key={project.id} className="pending-project-card">
                  <div className="project-header">
                    <h3>{project.name}</h3>
                    <span 
                      className="project-state"
                      style={{ backgroundColor: getStateColor(project.state) }}
                    >
                      {getStateLabel(project.state)}
                    </span>
                  </div>
                  <div className="project-details">
                    <div className="project-meta">
                      <span>📅 {formatDate(project.start_date)} - {formatDate(project.end_date)}</span>
                      <span>🏢 {project.contractor_organization || 'Nezadáno'}</span>
                    </div>
                    <div className="project-type">{project.work_type}</div>
                    {project.has_conflict && (
                      <div className="conflict-warning">
                        ⚠️ Detekován konflikt s jiným projektem
                      </div>
                    )}
                  </div>
                  <div className="project-actions">
                    <button className="btn-approve">Schválit</button>
                    <button className="btn-review">Zobrazit detail</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="dashboard-section">
          <h2>Nedávné události</h2>
          <div className="activities-list">
            {recentActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{activity.projectName}</div>
                  <div className="activity-description">{activity.description}</div>
                  <div className="activity-time">{formatTime(activity.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboard;