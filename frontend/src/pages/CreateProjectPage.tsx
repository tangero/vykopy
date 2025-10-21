import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import MapContainer from '../components/MapContainer';
import ProjectForm from '../components/ProjectForm';
import { projectService } from '../services/projectService';
import type { CompleteProjectFormData } from '../validation/projectSchemas';
import type { Geometry } from 'geojson';
import type { Project } from '../types';

interface LayoutContext {
  openSidebar: (content: React.ReactNode) => void;
  closeSidebar: () => void;
}

const CreateProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { openSidebar, closeSidebar } = useOutletContext<LayoutContext>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawnGeometry, setDrawnGeometry] = useState<Geometry | null>(null);

  const handleGeometryDrawn = useCallback((geometry: Geometry) => {
    setDrawnGeometry(geometry);
    
    // Mock municipality detection - in real app this would call an API
    // For now, we'll just set some mock municipalities
    const mockMunicipalities = ['Praha', 'Brno']; // This should be replaced with actual API call
    
    console.log('Geometry drawn:', geometry);
    console.log('Affected municipalities:', mockMunicipalities);
  }, []);

  const handleFormSubmit = async (data: CompleteProjectFormData) => {
    setIsSubmitting(true);
    
    try {
      // Ensure we have geometry
      if (!drawnGeometry && !data.geometry) {
        alert('Musíte vybrat lokalitu na mapě');
        setIsSubmitting(false);
        return;
      }

      // Add the drawn geometry to the form data
      const projectData = {
        ...data,
        geometry: drawnGeometry || data.geometry,
        // Mock affected municipalities - in real app this would be calculated from geometry
        affected_municipalities: ['Praha', 'Brno']
      };

      console.log('Submitting project for approval:', projectData);
      
      // Submit project (not as draft)
      await projectService.createProject(projectData, false);
      
      // Navigate back to projects page
      navigate('/projects');
      
      // Show success message (you might want to use a toast notification)
      alert('Projekt byl úspěšně odeslán ke schválení!');
      
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Chyba při vytváření projektu. Zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDraftSaved = (project: Project) => {
    console.log('Draft saved:', project);
    // You could show a toast notification here
  };

  const handleFormCancel = () => {
    closeSidebar();
    navigate('/projects');
  };

  const renderForm = useCallback(() => (
    <ProjectForm
      onSubmit={handleFormSubmit}
      onCancel={handleFormCancel}
      isSubmitting={isSubmitting}
      enableAutoSave={true}
      onDraftSaved={handleDraftSaved}
      initialData={drawnGeometry ? { 
        geometry: drawnGeometry,
        affected_municipalities: ['Praha', 'Brno'] // Mock data
      } : undefined}
    />
  ), [handleFormSubmit, handleFormCancel, isSubmitting, drawnGeometry]);

  // Open the form in sidebar when component mounts or when geometry changes
  useEffect(() => {
    openSidebar(renderForm());
  }, [openSidebar, renderForm]);

  return (
    <div className="create-project-page">
      <MapContainer 
        onGeometryDrawn={handleGeometryDrawn}
        showDrawingTools={true}
        showFilters={false}
        showSearch={true}
        enableDrawingMode={true}
      />
    </div>
  );
};

export default CreateProjectPage;