import React from 'react';
import { useSelector } from 'react-redux';
import { useOutletContext } from 'react-router-dom';
import type { RootState } from '../store';
import CoordinatorDashboard from '../components/CoordinatorDashboard';
import ProjectDetail from '../components/ProjectDetail';

interface LayoutContext {
  openSidebar: (content: React.ReactNode) => void;
  closeSidebar: () => void;
}

const DashboardPage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { openSidebar } = useOutletContext<LayoutContext>();

  // Sample project data for demonstration
  const sampleProject = {
    id: '1',
    name: 'Rekonstrukce vodovodu - Hlavní ulice',
    applicant: 'Vodárny Středních Čech',
    contractor: 'Stavební firma ABC s.r.o.',
    state: 'pending_approval',
    startDate: '2024-03-15',
    endDate: '2024-04-30',
    workType: 'Rekonstrukce vodovodu',
    description: 'Kompletní rekonstrukce vodovodního řadu v délce 200m včetně nových přípojek pro 15 domů.',
    location: 'Hlavní ulice 1-30, Beroun'
  };

  const handleShowProjectDetail = () => {
    openSidebar(<ProjectDetail projectId={sampleProject.id} />);
  };

  // Show coordinator dashboard for coordinators and regional admins
  if (user?.role === 'municipal_coordinator' || user?.role === 'regional_admin') {
    return <CoordinatorDashboard />;
  }

  // Default dashboard for applicants and other users
  return (
    <div className="dashboard-page">
      <h1>DigiKop Dashboard</h1>
      <p>Vítejte v systému pro koordinaci výkopových prací ve Středočeském kraji.</p>
      
      <div className="dashboard-demo">
        <h2>Rychlé akce</h2>
        <div className="quick-actions">
          <button className="action-button" onClick={() => window.location.href = '/projects'}>
            📋 Moje projekty
          </button>
          <button className="action-button" onClick={() => window.location.href = '/create-project'}>
            ➕ Nový projekt
          </button>
          <button onClick={handleShowProjectDetail}>
            👁️ Zobrazit demo projekt
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
