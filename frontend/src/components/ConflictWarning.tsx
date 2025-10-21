import React from 'react';
import type { ConflictDetectionResult } from '../services/conflictDetectionService';
import './ConflictWarning.css';

interface ConflictWarningProps {
  conflicts: ConflictDetectionResult;
  onContinue: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const ConflictWarning: React.FC<ConflictWarningProps> = ({
  conflicts,
  onContinue,
  onCancel,
  isSubmitting = false
}) => {
  const { summary, spatialConflicts, temporalConflicts, moratoriumViolations } = conflicts;

  const getSeverityLevel = () => {
    if (summary.criticalConflicts > 0) return 'critical';
    if (summary.warnings > 0) return 'warning';
    return 'info';
  };

  const getSeverityIcon = () => {
    const severity = getSeverityLevel();
    switch (severity) {
      case 'critical':
        return '⚠️';
      case 'warning':
        return '⚡';
      default:
        return 'ℹ️';
    }
  };

  const getSeverityTitle = () => {
    const severity = getSeverityLevel();
    switch (severity) {
      case 'critical':
        return 'Kritické konflikty detekované';
      case 'warning':
        return 'Potenciální konflikty detekované';
      default:
        return 'Informace o konfliktech';
    }
  };

  return (
    <div className={`conflict-warning ${getSeverityLevel()}`}>
      <div className="conflict-warning-header">
        <span className="conflict-icon">{getSeverityIcon()}</span>
        <h3>{getSeverityTitle()}</h3>
      </div>

      <div className="conflict-summary">
        <p>
          Bylo detekováno <strong>{summary.totalConflicts}</strong> potenciálních konfliktů
          {summary.criticalConflicts > 0 && (
            <span className="critical-note">
              {' '}(z toho <strong>{summary.criticalConflicts}</strong> kritických)
            </span>
          )}
        </p>
      </div>

      <div className="conflict-details">
        {temporalConflicts.length > 0 && (
          <div className="conflict-section critical">
            <h4>🚫 Časové konflikty ({temporalConflicts.length})</h4>
            <p className="section-description">
              Tyto projekty probíhají ve stejném čase a prostoru:
            </p>
            <ul>
              {temporalConflicts.map(project => (
                <li key={project.id}>
                  <strong>{project.name}</strong>
                  <br />
                  <span className="project-details">
                    {project.start_date} - {project.end_date} | {project.work_category}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {moratoriumViolations.length > 0 && (
          <div className="conflict-section critical moratorium-section">
            <h4>🚧 Narušení moratorií ({moratoriumViolations.length})</h4>
            <p className="section-description">
              Projekt zasahuje do oblastí s aktivními omezeními. Kontaktujte koordinátora pro posouzení možnosti výjimky.
            </p>
            <ul>
              {moratoriumViolations.map(moratorium => (
                <li key={moratorium.id}>
                  <strong>{moratorium.name}</strong>
                  <br />
                  <span className="moratorium-details">
                    Platné do: {moratorium.validTo.toLocaleDateString('cs-CZ')} | {moratorium.reasonDetail || moratorium.reason}
                  </span>
                  {moratorium.exceptions && (
                    <div className="moratorium-exceptions">
                      <small><strong>Výjimky:</strong> {moratorium.exceptions}</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {spatialConflicts.length > temporalConflicts.length && (
          <div className="conflict-section warning">
            <h4>📍 Prostorové konflikty ({spatialConflicts.length - temporalConflicts.length})</h4>
            <p className="section-description">
              Tyto projekty jsou v blízkosti, ale neprobíhají současně:
            </p>
            <ul>
              {spatialConflicts
                .filter(project => !temporalConflicts.includes(project))
                .map(project => (
                  <li key={project.id}>
                    <strong>{project.name}</strong>
                    <br />
                    <span className="project-details">
                      {project.start_date} - {project.end_date} | {project.work_category}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      <div className="conflict-actions">
        <div className="action-info">
          {summary.criticalConflicts > 0 ? (
            <p className="critical-warning">
              ⚠️ Kritické konflikty vyžadují koordinaci s dotčenými stranami před pokračováním.
            </p>
          ) : (
            <p className="warning-info">
              💡 Můžete pokračovat, ale doporučujeme koordinaci s dotčenými projekty.
            </p>
          )}
        </div>

        <div className="action-buttons">
          <button 
            type="button" 
            onClick={onCancel} 
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Upravit projekt
          </button>
          <button 
            type="button" 
            onClick={onContinue} 
            className={`btn ${summary.criticalConflicts > 0 ? 'btn-warning' : 'btn-primary'}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Odesílání...' : 'Pokračovat přesto'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictWarning;