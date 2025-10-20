import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ProjectDetail from '../components/ProjectDetail';

interface LayoutContext {
  openSidebar: (content: React.ReactNode) => void;
  closeSidebar: () => void;
}

const DashboardPage: React.FC = () => {
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

  return (
    <div className="dashboard-page">
      <h1>DigiKop Dashboard</h1>
      <p>Vítejte v systému pro koordinaci výkopových prací ve Středočeském kraji.</p>
      
      <div className="dashboard-demo">
        <h2>Demo funkcionalita</h2>
        <p>Klikněte na tlačítko níže pro zobrazení detailu projektu v postranním panelu:</p>
        <button onClick={handleShowProjectDetail}>
          Zobrazit detail projektu
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
