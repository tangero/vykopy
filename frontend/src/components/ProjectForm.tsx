import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Geometry } from 'geojson';
import { projectService, type CreateProjectRequest } from '../services/projectService';
import { conflictDetectionService, type ConflictDetectionResult } from '../services/conflictDetectionService';
import { useAutoSave } from '../hooks/useAutoSave';
import ConflictWarning from './ConflictWarning';
import type { Project } from '../types';
import './ProjectForm.css';
import {
  basicInfoSchema,
  locationSchema,
  timelineSchema,
  workTypeOptions,
  workCategoryOptions,
  type BasicInfoFormData,
  type LocationFormData,
  type TimelineFormData,
  type CompleteProjectFormData
} from '../validation/projectSchemas';

interface ProjectFormProps {
  onSubmit: (data: CompleteProjectFormData) => void;
  onCancel: () => void;
  initialData?: Partial<CompleteProjectFormData>;
  isSubmitting?: boolean;
  projectId?: string; // For editing existing projects
  enableAutoSave?: boolean;
  onDraftSaved?: (project: Project) => void;
}

type FormStep = 'basic' | 'location' | 'timeline' | 'conflicts';

const ProjectForm: React.FC<ProjectFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
  projectId,
  enableAutoSave = true,
  onDraftSaved
}) => {
  const [currentStep, setCurrentStep] = useState<FormStep>('basic');
  const [formData, setFormData] = useState<Partial<CompleteProjectFormData>>(initialData || {});
  const [drawnGeometry, setDrawnGeometry] = useState<Geometry | null>(
    initialData?.geometry || null
  );
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(projectId);
  const [isDetectingConflicts, setIsDetectingConflicts] = useState(false);
  const [conflictResults, setConflictResults] = useState<ConflictDetectionResult | null>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<CompleteProjectFormData | null>(null);

  // Step 1: Basic Information Form
  const basicForm = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: formData.name || '',
      applicant_organization: formData.applicant_organization || '',
      contractor_organization: formData.contractor_organization || '',
      contractor_contact: formData.contractor_contact || {
        name: '',
        phone: '',
        email: ''
      },
      description: formData.description || ''
    }
  });

  // Step 2: Location Form
  const locationForm = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      geometry: formData.geometry || undefined,
      affected_municipalities: formData.affected_municipalities || []
    }
  });

  // Step 3: Timeline Form
  const timelineForm = useForm<TimelineFormData>({
    resolver: zodResolver(timelineSchema),
    defaultValues: {
      start_date: formData.start_date || '',
      end_date: formData.end_date || '',
      work_type: formData.work_type || '',
      work_category: formData.work_category || ''
    }
  });

  const handleBasicInfoNext = (data: BasicInfoFormData) => {
    const updatedData = { ...formData, ...data };
    setFormData(updatedData);
    setCurrentStep('location');
  };

  const handleLocationNext = (data: LocationFormData) => {
    const updatedData = { ...formData, ...data };
    setFormData(updatedData);
    setCurrentStep('timeline');
  };

  const handleTimelineSubmit = async (data: TimelineFormData) => {
    const completeData: CompleteProjectFormData = {
      ...formData,
      ...data
    } as CompleteProjectFormData;
    
    // Run conflict detection before submitting
    await runConflictDetection(completeData);
  };

  const runConflictDetection = async (data: CompleteProjectFormData) => {
    if (!data.geometry) {
      alert('Chyba: Geometrie projektu není definována');
      return;
    }

    setIsDetectingConflicts(true);
    try {
      const conflicts = await conflictDetectionService.detectConflicts({
        geometry: data.geometry,
        startDate: data.start_date,
        endDate: data.end_date,
        excludeProjectId: currentProjectId
      });

      if (conflicts.hasConflict) {
        // Show conflict warning
        setConflictResults(conflicts);
        setPendingSubmitData(data);
        setCurrentStep('conflicts');
      } else {
        // No conflicts, submit directly
        onSubmit(data);
      }
    } catch (error) {
      console.error('Conflict detection failed:', error);
      alert('Chyba při detekci konfliktů. Projekt bude odeslán bez kontroly.');
      onSubmit(data);
    } finally {
      setIsDetectingConflicts(false);
    }
  };

  const handleConflictContinue = () => {
    if (pendingSubmitData) {
      onSubmit(pendingSubmitData);
    }
  };

  const handleConflictCancel = () => {
    setCurrentStep('timeline');
    setConflictResults(null);
    setPendingSubmitData(null);
  };

  const handleSaveDraft = async () => {
    // Get current form values from all steps
    const basicData = basicForm.getValues();
    const locationData = locationForm.getValues();
    const timelineData = timelineForm.getValues();
    
    const draftData = {
      ...formData,
      ...basicData,
      ...locationData,
      ...timelineData
    };

    await saveDraft(draftData);
  };

  // Auto-save function
  const saveDraft = useCallback(async (data: Partial<CompleteProjectFormData>) => {
    if (!data.name || data.name.trim().length < 3) {
      // Don't auto-save if we don't have a minimum viable draft
      return;
    }

    setIsDraftSaving(true);
    try {
      const projectData: CreateProjectRequest = {
        name: data.name,
        applicant_organization: data.applicant_organization,
        contractor_organization: data.contractor_organization,
        contractor_contact: data.contractor_contact,
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        geometry: drawnGeometry || data.geometry!,
        work_type: data.work_type || '',
        work_category: data.work_category || '',
        description: data.description,
        affected_municipalities: data.affected_municipalities || []
      };

      // Only save if we have the required fields for a draft
      if (!projectData.geometry) {
        return;
      }

      let savedProject: Project;
      if (currentProjectId) {
        // Update existing draft
        savedProject = await projectService.updateProject({
          id: currentProjectId,
          ...projectData
        }, true);
      } else {
        // Create new draft
        savedProject = await projectService.createProject(projectData, true);
        setCurrentProjectId(savedProject.id);
      }

      setLastSaved(new Date());
      if (onDraftSaved) {
        onDraftSaved(savedProject);
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsDraftSaving(false);
    }
  }, [drawnGeometry, currentProjectId, onDraftSaved]);

  // Set up auto-save
  useAutoSave(
    formData,
    saveDraft,
    { enabled: enableAutoSave && !isSubmitting }
  );

  // Update form when initial data changes (including geometry from map)
  useEffect(() => {
    if (initialData?.geometry) {
      setDrawnGeometry(initialData.geometry);
      locationForm.setValue('geometry', initialData.geometry);
    }
    if (initialData?.affected_municipalities) {
      locationForm.setValue('affected_municipalities', initialData.affected_municipalities);
    }
  }, [initialData, locationForm]);

  const goToPreviousStep = () => {
    switch (currentStep) {
      case 'location':
        setCurrentStep('basic');
        break;
      case 'timeline':
        setCurrentStep('location');
        break;
    }
  };

  const renderStepIndicator = () => (
    <div className="form-step-indicator">
      <div className={`step ${currentStep === 'basic' ? 'active' : 'completed'}`}>
        <span className="step-number">1</span>
        <span className="step-label">Základní informace</span>
      </div>
      <div className={`step ${currentStep === 'location' ? 'active' : (currentStep === 'timeline' || currentStep === 'conflicts') ? 'completed' : ''}`}>
        <span className="step-number">2</span>
        <span className="step-label">Lokalita</span>
      </div>
      <div className={`step ${currentStep === 'timeline' ? 'active' : currentStep === 'conflicts' ? 'completed' : ''}`}>
        <span className="step-number">3</span>
        <span className="step-label">Časový rámec</span>
      </div>
      {currentStep === 'conflicts' && (
        <div className="step active">
          <span className="step-number">4</span>
          <span className="step-label">Kontrola konfliktů</span>
        </div>
      )}
    </div>
  );

  const renderBasicInfoStep = () => (
    <form onSubmit={basicForm.handleSubmit(handleBasicInfoNext)} className="project-form-step">
      <h3>Základní informace o projektu</h3>
      
      <div className="form-group">
        <label htmlFor="name">Název projektu *</label>
        <input
          id="name"
          type="text"
          {...basicForm.register('name')}
          className={basicForm.formState.errors.name ? 'error' : ''}
        />
        {basicForm.formState.errors.name && (
          <span className="error-message">{basicForm.formState.errors.name.message}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="applicant_organization">Žadatel (organizace) *</label>
        <input
          id="applicant_organization"
          type="text"
          {...basicForm.register('applicant_organization')}
          className={basicForm.formState.errors.applicant_organization ? 'error' : ''}
        />
        {basicForm.formState.errors.applicant_organization && (
          <span className="error-message">{basicForm.formState.errors.applicant_organization.message}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="contractor_organization">Zhotovitel (organizace)</label>
        <input
          id="contractor_organization"
          type="text"
          {...basicForm.register('contractor_organization')}
          className={basicForm.formState.errors.contractor_organization ? 'error' : ''}
        />
        {basicForm.formState.errors.contractor_organization && (
          <span className="error-message">{basicForm.formState.errors.contractor_organization.message}</span>
        )}
      </div>

      <fieldset className="form-fieldset">
        <legend>Kontaktní osoba zhotovitele</legend>
        
        <div className="form-group">
          <label htmlFor="contractor_name">Jméno</label>
          <input
            id="contractor_name"
            type="text"
            {...basicForm.register('contractor_contact.name')}
            className={basicForm.formState.errors.contractor_contact?.name ? 'error' : ''}
          />
          {basicForm.formState.errors.contractor_contact?.name && (
            <span className="error-message">{basicForm.formState.errors.contractor_contact.name.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="contractor_phone">Telefon</label>
          <input
            id="contractor_phone"
            type="tel"
            placeholder="+420123456789"
            {...basicForm.register('contractor_contact.phone')}
            className={basicForm.formState.errors.contractor_contact?.phone ? 'error' : ''}
          />
          {basicForm.formState.errors.contractor_contact?.phone && (
            <span className="error-message">{basicForm.formState.errors.contractor_contact.phone.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="contractor_email">Email</label>
          <input
            id="contractor_email"
            type="email"
            {...basicForm.register('contractor_contact.email')}
            className={basicForm.formState.errors.contractor_contact?.email ? 'error' : ''}
          />
          {basicForm.formState.errors.contractor_contact?.email && (
            <span className="error-message">{basicForm.formState.errors.contractor_contact.email.message}</span>
          )}
        </div>
      </fieldset>

      <div className="form-group">
        <label htmlFor="description">Popis projektu</label>
        <textarea
          id="description"
          rows={4}
          {...basicForm.register('description')}
          className={basicForm.formState.errors.description ? 'error' : ''}
        />
        {basicForm.formState.errors.description && (
          <span className="error-message">{basicForm.formState.errors.description.message}</span>
        )}
      </div>

      <div className="form-actions">
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Zrušit
        </button>
        <button 
          type="button" 
          onClick={handleSaveDraft} 
          className="btn btn-outline"
          disabled={isDraftSaving}
        >
          {isDraftSaving ? 'Ukládání...' : 'Uložit koncept'}
        </button>
        <button type="submit" className="btn btn-primary">
          Další krok
        </button>
      </div>
    </form>
  );

  const renderLocationStep = () => (
    <form onSubmit={locationForm.handleSubmit(handleLocationNext)} className="project-form-step">
      <h3>Vyznačení lokality</h3>
      
      <div className="form-group">
        <label>Lokalita projektu *</label>
        <div className="map-drawing-area">
          <p className="instruction-text">
            Použijte kreslicí nástroje na mapě pro vyznačení lokality projektu.
            Můžete kreslit body, linie nebo polygony podle typu práce.
          </p>
          
          {drawnGeometry && (
            <div className="geometry-info">
              <p className="success-message">
                ✓ Geometrie typu {drawnGeometry.type} byla vyznačena
              </p>
            </div>
          )}
          
          {locationForm.formState.errors.geometry && (
            <span className="error-message">{locationForm.formState.errors.geometry.message}</span>
          )}
        </div>
      </div>

      {formData.affected_municipalities && formData.affected_municipalities.length > 0 && (
        <div className="form-group">
          <label>Dotčené obce</label>
          <div className="municipalities-list">
            {formData.affected_municipalities.map((municipality, index) => (
              <span key={index} className="municipality-tag">
                {municipality}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="button" onClick={goToPreviousStep} className="btn btn-secondary">
          Předchozí krok
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Zrušit
        </button>
        <button 
          type="button" 
          onClick={handleSaveDraft} 
          className="btn btn-outline"
          disabled={isDraftSaving}
        >
          {isDraftSaving ? 'Ukládání...' : 'Uložit koncept'}
        </button>
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={!drawnGeometry}
        >
          Další krok
        </button>
      </div>
    </form>
  );

  const renderTimelineStep = () => (
    <form onSubmit={timelineForm.handleSubmit(handleTimelineSubmit)} className="project-form-step">
      <h3>Časový rámec a kategorizace</h3>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="start_date">Datum zahájení *</label>
          <input
            id="start_date"
            type="date"
            {...timelineForm.register('start_date')}
            className={timelineForm.formState.errors.start_date ? 'error' : ''}
          />
          {timelineForm.formState.errors.start_date && (
            <span className="error-message">{timelineForm.formState.errors.start_date.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="end_date">Datum ukončení *</label>
          <input
            id="end_date"
            type="date"
            {...timelineForm.register('end_date')}
            className={timelineForm.formState.errors.end_date ? 'error' : ''}
          />
          {timelineForm.formState.errors.end_date && (
            <span className="error-message">{timelineForm.formState.errors.end_date.message}</span>
          )}
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="work_type">Typ práce *</label>
        <select
          id="work_type"
          {...timelineForm.register('work_type')}
          className={timelineForm.formState.errors.work_type ? 'error' : ''}
        >
          <option value="">Vyberte typ práce</option>
          {workTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {timelineForm.formState.errors.work_type && (
          <span className="error-message">{timelineForm.formState.errors.work_type.message}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="work_category">Kategorie práce *</label>
        <select
          id="work_category"
          {...timelineForm.register('work_category')}
          className={timelineForm.formState.errors.work_category ? 'error' : ''}
        >
          <option value="">Vyberte kategorii práce</option>
          {workCategoryOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {timelineForm.formState.errors.work_category && (
          <span className="error-message">{timelineForm.formState.errors.work_category.message}</span>
        )}
      </div>

      <div className="form-actions">
        <button type="button" onClick={goToPreviousStep} className="btn btn-secondary">
          Předchozí krok
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Zrušit
        </button>
        <button 
          type="button" 
          onClick={handleSaveDraft} 
          className="btn btn-outline"
          disabled={isDraftSaving || isSubmitting}
        >
          {isDraftSaving ? 'Ukládání...' : 'Uložit koncept'}
        </button>
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isSubmitting || isDetectingConflicts}
        >
          {isDetectingConflicts ? 'Kontrola konfliktů...' : isSubmitting ? 'Odesílání...' : 'Odeslat ke schválení'}
        </button>
      </div>
    </form>
  );

  const renderConflictsStep = () => {
    if (!conflictResults) return null;

    return (
      <div className="project-form-step">
        <ConflictWarning
          conflicts={conflictResults}
          onContinue={handleConflictContinue}
          onCancel={handleConflictCancel}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  };

  return (
    <div className="project-form">
      {renderStepIndicator()}
      
      {/* Auto-save indicator */}
      {enableAutoSave && (
        <div className="auto-save-indicator">
          {isDraftSaving && (
            <span className="saving">
              <span className="spinner"></span>
              Ukládání konceptu...
            </span>
          )}
          {lastSaved && !isDraftSaving && (
            <span className="saved">
              ✓ Koncept uložen {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
      
      <div className="form-content">
        {currentStep === 'basic' && renderBasicInfoStep()}
        {currentStep === 'location' && renderLocationStep()}
        {currentStep === 'timeline' && renderTimelineStep()}
        {currentStep === 'conflicts' && renderConflictsStep()}
      </div>
    </div>
  );
};

export default ProjectForm;