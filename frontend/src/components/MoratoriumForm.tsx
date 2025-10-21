import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Geometry } from 'geojson';
import {
  moratoriumSchema,
  moratoriumReasonOptions,
  municipalityOptions,
  type MoratoriumFormData
} from '../validation/moratoriumSchemas';
import './MoratoriumForm.css';

interface MoratoriumFormProps {
  onSubmit: (data: MoratoriumFormData) => void;
  onCancel: () => void;
  initialData?: Partial<MoratoriumFormData>;
  isSubmitting?: boolean;
  moratoriumId?: string; // For editing existing moratoriums
  drawnGeometry?: Geometry | null;
  onGeometryChange?: (geometry: Geometry | null) => void;
}

const MoratoriumForm: React.FC<MoratoriumFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
  moratoriumId,
  drawnGeometry,
  onGeometryChange
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [overlapWarnings, setOverlapWarnings] = useState<string[]>([]);

  const form = useForm<MoratoriumFormData>({
    resolver: zodResolver(moratoriumSchema),
    defaultValues: {
      name: initialData?.name || '',
      reason: initialData?.reason || '',
      reasonDetail: initialData?.reasonDetail || '',
      validFrom: initialData?.validFrom || '',
      validTo: initialData?.validTo || '',
      exceptions: initialData?.exceptions || '',
      municipalityCode: initialData?.municipalityCode || '',
      geometry: initialData?.geometry || drawnGeometry || undefined
    }
  });

  // Update geometry when drawn on map
  useEffect(() => {
    if (drawnGeometry) {
      form.setValue('geometry', drawnGeometry);
      form.clearErrors('geometry');
    }
  }, [drawnGeometry, form]);

  // Calculate maximum valid date (5 years from start date)
  const validFromValue = form.watch('validFrom');
  const maxValidTo = React.useMemo(() => {
    if (!validFromValue) return '';
    const startDate = new Date(validFromValue);
    const maxDate = new Date(startDate);
    maxDate.setFullYear(maxDate.getFullYear() + 5);
    return maxDate.toISOString().split('T')[0];
  }, [validFromValue]);

  const handleSubmit = async (data: MoratoriumFormData) => {
    setIsLoading(true);
    setOverlapWarnings([]);

    try {
      // Validate geometry is available
      if (!data.geometry && !drawnGeometry) {
        form.setError('geometry', {
          type: 'manual',
          message: 'Musíte vyznačit oblast moratoria na mapě'
        });
        setIsLoading(false);
        return;
      }

      const geometryToUse = data.geometry || drawnGeometry!;
      const submitData: MoratoriumFormData = {
        ...data,
        geometry: geometryToUse
      };

      onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
      alert('Chyba při odesílání formuláře. Zkuste to prosím znovu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReasonChange = (reason: string) => {
    form.setValue('reason', reason);

    // Auto-fill reason detail for common cases
    const reasonOption = moratoriumReasonOptions.find(opt => opt.value === reason);
    if (reasonOption && !form.getValues('reasonDetail')) {
      let autoDetail = '';
      switch (reason) {
        case 'road_reconstruction':
          autoDetail = 'Probíhá rekonstrukce komunikace, zákaz výkopů z důvodu ochrany nově položeného povrchu.';
          break;
        case 'fresh_asphalt':
          autoDetail = 'Čerstvě položený asfaltový povrch - zákaz výkopů po dobu stabilizace materiálu.';
          break;
        case 'major_infrastructure':
          autoDetail = 'Výstavba významné infrastruktury vyžaduje koordinaci všech zásahů v oblasti.';
          break;
        case 'environmental_protection':
          autoDetail = 'Ochrana životního prostředí nebo chráněných druhů v dané lokalitě.';
          break;
        case 'archaeological_research':
          autoDetail = 'Probíhá archeologický výzkum, jakékoliv zemní práce musí být koordinovány.';
          break;
        case 'safety_concerns':
          autoDetail = 'Bezpečnostní důvody vyžadují omezení zemních prací v této oblasti.';
          break;
      }
      if (autoDetail) {
        form.setValue('reasonDetail', autoDetail);
      }
    }
  };

  const clearGeometry = () => {
    form.setValue('geometry', null as any);
    if (onGeometryChange) {
      onGeometryChange(null);
    }
  };

  return (
    <div className="moratorium-form">
      <form onSubmit={form.handleSubmit(handleSubmit)} className="moratorium-form-content">
        <h3>{moratoriumId ? 'Upravit moratorium' : 'Nové moratorium'}</h3>

        {overlapWarnings.length > 0 && (
          <div className="overlap-warnings">
            <h4>⚠️ Upozornění na překryvy</h4>
            <ul>
              {overlapWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name">Název moratoria *</label>
          <input
            id="name"
            type="text"
            placeholder="např. Rekonstrukce Hlavní ulice"
            {...form.register('name')}
            className={form.formState.errors.name ? 'error' : ''}
          />
          {form.formState.errors.name && (
            <span className="error-message">{form.formState.errors.name.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="municipalityCode">Obec *</label>
          <select
            id="municipalityCode"
            {...form.register('municipalityCode')}
            className={form.formState.errors.municipalityCode ? 'error' : ''}
          >
            <option value="">Vyberte obec</option>
            {municipalityOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {form.formState.errors.municipalityCode && (
            <span className="error-message">{form.formState.errors.municipalityCode.message}</span>
          )}
        </div>

        <div className="form-group">
          <label>Oblast moratoria *</label>
          <div className="geometry-drawing-area">
            <p className="instruction-text">
              Použijte kreslicí nástroje na mapě pro vyznačení oblasti moratoria.
              Můžete kreslit linie nebo polygony podle rozsahu omezení.
            </p>

            {(drawnGeometry || form.getValues('geometry')) && (
              <div className="geometry-info">
                <p className="success-message">
                  ✓ Oblast typu {(drawnGeometry || form.getValues('geometry'))?.type} byla vyznačena
                </p>
                <button
                  type="button"
                  onClick={clearGeometry}
                  className="btn btn-outline btn-small"
                >
                  Vymazat oblast
                </button>
              </div>
            )}

            {form.formState.errors.geometry && (
              <span className="error-message">{form.formState.errors.geometry.message}</span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="validFrom">Platné od *</label>
            <input
              id="validFrom"
              type="date"
              {...form.register('validFrom')}
              className={form.formState.errors.validFrom ? 'error' : ''}
            />
            {form.formState.errors.validFrom && (
              <span className="error-message">{form.formState.errors.validFrom.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="validTo">Platné do *</label>
            <input
              id="validTo"
              type="date"
              max={maxValidTo}
              {...form.register('validTo')}
              className={form.formState.errors.validTo ? 'error' : ''}
            />
            {form.formState.errors.validTo && (
              <span className="error-message">{form.formState.errors.validTo.message}</span>
            )}
            {maxValidTo && (
              <span className="help-text">
                Maximální doba trvání: {maxValidTo} (5 let od začátku)
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="reason">Důvod moratoria *</label>
          <select
            id="reason"
            {...form.register('reason')}
            onChange={(e) => handleReasonChange(e.target.value)}
            className={form.formState.errors.reason ? 'error' : ''}
          >
            <option value="">Vyberte důvod</option>
            {moratoriumReasonOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {form.formState.errors.reason && (
            <span className="error-message">{form.formState.errors.reason.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="reasonDetail">Podrobný popis důvodu</label>
          <textarea
            id="reasonDetail"
            rows={4}
            placeholder="Detailní popis důvodu moratoria..."
            {...form.register('reasonDetail')}
            className={form.formState.errors.reasonDetail ? 'error' : ''}
          />
          {form.formState.errors.reasonDetail && (
            <span className="error-message">{form.formState.errors.reasonDetail.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="exceptions">Výjimky z moratoria</label>
          <textarea
            id="exceptions"
            rows={3}
            placeholder="Případné výjimky nebo speciální podmínky..."
            {...form.register('exceptions')}
            className={form.formState.errors.exceptions ? 'error' : ''}
          />
          {form.formState.errors.exceptions && (
            <span className="error-message">{form.formState.errors.exceptions.message}</span>
          )}
          <span className="help-text">
            Například: "Povoleny havarijní opravy po konzultaci s koordinátorem"
          </span>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={isSubmitting || isLoading}
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || isLoading || !drawnGeometry}
          >
            {isLoading ? 'Zpracování...' : isSubmitting ? 'Ukládání...' : moratoriumId ? 'Uložit změny' : 'Vytvořit moratorium'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MoratoriumForm;
