import React from 'react';
import { useOutletContext } from 'react-router-dom';
import MapContainer from '../components/MapContainer';
import ProjectDetail from '../components/ProjectDetail';

interface LayoutContext {
  openSidebar: (content: React.ReactNode) => void;
  closeSidebar: () => void;
}

const ProjectsPage: React.FC = () => {
  const { openSidebar } = useOutletContext<LayoutContext>();

  const handleProjectClick = (projectId: string) => {
    // Open project details in sidebar
    openSidebar(<ProjectDetail projectId={projectId} />);
  };

  const handleGeometryDrawn = (geometry: GeoJSON.Geometry) => {
    console.log('Geometry drawn:', geometry);
    // Here you would typically save the geometry or use it in a form
    alert(`Nakreslena geometrie typu: ${geometry.type}`);
  };

  return (
    <div className="projects-page">
      <MapContainer 
        onProjectClick={handleProjectClick}
        onGeometryDrawn={handleGeometryDrawn}
        showDrawingTools={true}
        showFilters={true}
        showSearch={true}
      />
    </div>
  );
};

export default ProjectsPage;
