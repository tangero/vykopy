import React from 'react';
import type { DrawingMode } from './DrawingTools';

interface DrawingToolbarProps {
  mode: DrawingMode;
  onModeChange: (mode: DrawingMode) => void;
  onClear?: () => void;
  className?: string;
}

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({ 
  mode, 
  onModeChange, 
  onClear, 
  className = '' 
}) => {
  const tools = [
    {
      id: 'none' as DrawingMode,
      name: 'Výběr',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      description: 'Normální režim - klikání na projekty'
    },
    {
      id: 'point' as DrawingMode,
      name: 'Bod',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="8"/>
        </svg>
      ),
      description: 'Klikněte na mapu pro umístění bodu'
    },
    {
      id: 'line' as DrawingMode,
      name: 'Linie',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 17l6-6 4 4 8-8"/>
        </svg>
      ),
      description: 'Klikněte pro přidání bodů, dvojklik pro dokončení'
    },
    {
      id: 'polygon' as DrawingMode,
      name: 'Polygon',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      description: 'Klikněte pro přidání bodů, dvojklik pro uzavření'
    }
  ];

  return (
    <div className={`drawing-toolbar ${className}`}>
      <div className="toolbar-panel">
        <h3>Kreslicí nástroje</h3>
        
        <div className="tool-buttons">
          {tools.map(tool => (
            <button
              key={tool.id}
              className={`tool-button ${mode === tool.id ? 'active' : ''}`}
              onClick={() => onModeChange(tool.id)}
              title={tool.description}
            >
              <span className="tool-icon">{tool.icon}</span>
              <span className="tool-name">{tool.name}</span>
            </button>
          ))}
        </div>

        {mode !== 'none' && (
          <div className="drawing-instructions">
            <div className="instruction-text">
              {mode === 'point' && 'Klikněte na mapu pro umístění bodu'}
              {mode === 'line' && 'Klikněte pro přidání bodů, dvojklik pro dokončení'}
              {mode === 'polygon' && 'Klikněte pro přidání bodů, dvojklik pro uzavření polygonu'}
            </div>
            <div className="instruction-shortcuts">
              <small>ESC - zrušit kreslení</small>
            </div>
          </div>
        )}

        {onClear && (
          <div className="toolbar-actions">
            <button 
              className="clear-button"
              onClick={onClear}
              title="Vymazat všechny nakreslené objekty"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              Vymazat vše
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawingToolbar;