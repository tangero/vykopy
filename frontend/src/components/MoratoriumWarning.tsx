import React from 'react';
import type { Moratorium } from '../types';
import './MoratoriumWarning.css';

interface MoratoriumWarningProps {
  moratoriums: Moratorium[];
  onContinue?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
  isSubmitting?: boolean;
  allowIgnore?: boolean; // For coordinators who can ignore moratoriums
}

const MoratoriumWarning: React.FC<MoratoriumWarningProps> = ({
  moratoriums,
  onContinue,
  onCancel,
  showActions = true,
  isSubmitting = false,
  allowIgnore = false
}) => {
  if (moratoriums.length === 0) return null;

  const getReasonLabel = (reason: string): string => {
    const reasonLabels: Record<string, string> = {
      'road_reconstruction': 'Rekonstrukce komunikace',
      'fresh_asphalt': 'Čerstvě položený asfalt',
      'major_infrastructure': 'Výstavba významné infrastruktury',
      'environmental_protection': 'Ochrana životního prostředí',
      'archaeological_research': 'Archeologický výzkum',
      'safety_concerns': 'Bezpečnostní důvody',
      'planned_development': 'Plánovaná výstavba',
      'other': 'Jiný důvod'
    };
    return reasonLabels[reason] || reason;
  };

  const isAnyActive = moratoriums.some(m => 
    m.validFrom <= new Date() && m.validTo >= new Date()
  );

  return (
    <div className={`moratorium-warning ${isAnyActive ? 'active' : 'inactive'}`}>
      <div className="moratorium-warning-header">
        <span className="moratorium-icon">🚧</span>
        <h3>
          {isAnyActive ? 'Aktivní moratoria v oblasti' : 'Moratoria v oblasti'}
        </h3>
      </div>

      <div className="moratorium-summary">
        <p>
          Projekt zasahuje do {moratoriums.length} {moratoriums.length === 1 ? 'oblasti' : 'oblastí'} s omezeními.
          {isAnyActive && (
            <span className="active-note">
              {' '}Některá omezení jsou v současnosti aktivní.
            </span>
          )}
        </p>
      </div>

      <div className="moratorium-list">
        {moratoriums.map(moratorium => {
          const isActive = moratorium.validFrom <= new Date() && moratorium.validTo >= new Date();
          const validFromStr = moratorium.validFrom.toLocaleDateString('cs-CZ');
          const validToStr = moratorium.validTo.toLocaleDateString('cs-CZ');
          
          return (
            <div key={moratorium.id} className={`moratorium-item ${isActive ? 'active' : 'inactive'}`}>
              <div className="moratorium-header">
                <h4>{moratorium.name}</h4>
                <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                  {isActive ? 'Aktivní' : 'Neaktivní'}
                </span>
              </div>
              
              <div className="moratorium-details">
                <p><strong>Důvod:</strong> {getReasonLabel(moratorium.reason)}</p>
                <p><strong>Platnost:</strong> {validFromStr} - {validToStr}</p>
                
                {moratorium.reasonDetail && (
                  <p><strong>Podrobnosti:</strong> {moratorium.reasonDetail}</p>
                )}
                
                {moratorium.exceptions && (
                  <div className="moratorium-exceptions">
                    <p><strong>Výjimky:</strong></p>
                    <p className="exceptions-text">{moratorium.exceptions}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showActions && (
        <div className="moratorium-actions">
          <div className="action-info">
            {isAnyActive ? (
              <p className="active-warning">
                ⚠️ Projekt zasahuje do aktivních moratorií. 
                {allowIgnore 
                  ? ' Jako koordinátor můžete pokračovat, ale doporučuje se koordinace.'
                  : ' Kontaktujte koordinátora pro posouzení možnosti výjimky.'
                }
              </p>
            ) : (
              <p className="inactive-info">
                💡 Moratoria nejsou v současnosti aktivní, ale mohou ovlivnit budoucí plánování.
              </p>
            )}
          </div>

          {(onContinue || onCancel) && (
            <div className="action-buttons">
              {onCancel && (
                <button 
                  type="button" 
                  onClick={onCancel} 
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  {isAnyActive ? 'Upravit projekt' : 'Zpět'}
                </button>
              )}
              {onContinue && (
                <button 
                  type="button" 
                  onClick={onContinue} 
                  className={`btn ${isAnyActive ? 'btn-warning' : 'btn-primary'}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Zpracování...' : 
                   isAnyActive ? (allowIgnore ? 'Pokračovat přesto' : 'Požádat o výjimku') : 'Pokračovat'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MoratoriumWarning;