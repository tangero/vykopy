import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Moratorium } from '../types';
import { moratoriumService } from '../services/moratoriumService';
import './MoratoriumExceptionDialog.css';

const exceptionSchema = z.object({
  reason: z.string()
    .min(10, 'Důvod výjimky musí mít alespoň 10 znaků')
    .max(500, 'Důvod výjimky může mít maximálně 500 znaků')
});

type ExceptionFormData = z.infer<typeof exceptionSchema>;

interface MoratoriumExceptionDialogProps {
  moratorium: Moratorium;
  projectId: string;
  projectName: string;
  onApprove: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const MoratoriumExceptionDialog: React.FC<MoratoriumExceptionDialogProps> = ({
  moratorium,
  projectId,
  projectName,
  onApprove,
  onCancel,
  isOpen
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ExceptionFormData>({
    resolver: zodResolver(exceptionSchema),
    defaultValues: {
      reason: ''
    }
  });

  const handleSubmit = async (data: ExceptionFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await moratoriumService.approveProjectWithMoratoriumException(
        projectId,
        moratorium.id,
        data.reason
      );
      
      onApprove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při schvalování výjimky');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const validFromStr = moratorium.validFrom.toLocaleDateString('cs-CZ');
  const validToStr = moratorium.validTo.toLocaleDateString('cs-CZ');

  return (
    <div className="moratorium-exception-overlay">
      <div className="moratorium-exception-dialog">
        <div className="dialog-header">
          <h3>Schválení výjimky z moratoria</h3>
          <button 
            type="button" 
            onClick={onCancel}
            className="close-button"
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <div className="dialog-content">
          <div className="moratorium-info">
            <h4>Moratorium</h4>
            <p><strong>{moratorium.name}</strong></p>
            <p>Platnost: {validFromStr} - {validToStr}</p>
            <p>Důvod: {moratorium.reasonDetail || moratorium.reason}</p>
            {moratorium.exceptions && (
              <p>Stávající výjimky: {moratorium.exceptions}</p>
            )}
          </div>

          <div className="project-info">
            <h4>Projekt</h4>
            <p><strong>{projectName}</strong></p>
            <p>ID: {projectId}</p>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="form-group">
              <label htmlFor="reason">Důvod schválení výjimky *</label>
              <textarea
                id="reason"
                rows={4}
                placeholder="Uveďte podrobný důvod, proč je výjimka z moratoria oprávněná..."
                {...form.register('reason')}
                className={form.formState.errors.reason ? 'error' : ''}
                disabled={isSubmitting}
              />
              {form.formState.errors.reason && (
                <span className="error-message">{form.formState.errors.reason.message}</span>
              )}
            </div>

            {error && (
              <div className="error-alert">
                <p>{error}</p>
              </div>
            )}

            <div className="dialog-actions">
              <button 
                type="button" 
                onClick={onCancel}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Zrušit
              </button>
              <button 
                type="submit"
                className="btn btn-warning"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Schvalování...' : 'Schválit výjimku'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MoratoriumExceptionDialog;