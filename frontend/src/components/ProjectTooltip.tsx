import React, { useEffect, useState } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';

interface TooltipData {
  id: string;
  name: string;
  state: string;
  applicant: string;
  workType: string;
  startDate: string;
  endDate: string;
  x: number;
  y: number;
}

interface ProjectTooltipProps {
  map: MapboxMap | null;
}

const ProjectTooltip: React.FC<ProjectTooltipProps> = ({ map }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const getStateDisplayName = (state: string) => {
    switch (state) {
      case 'draft':
        return 'Koncept';
      case 'forward_planning':
        return 'Předběžné plánování';
      case 'pending_approval':
        return 'Čeká na schválení';
      case 'approved':
        return 'Schváleno';
      case 'in_progress':
        return 'Probíhá';
      case 'completed':
        return 'Dokončeno';
      case 'rejected':
        return 'Zamítnuto';
      case 'cancelled':
        return 'Zrušeno';
      default:
        return state;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  useEffect(() => {
    if (!map) return;

    const layers = ['projects-fill', 'projects-line', 'projects-point'];

    const handleMouseMove = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers });
      
      if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        
        if (props) {
          setTooltip({
            id: props.id,
            name: props.name,
            state: props.state,
            applicant: props.applicant,
            workType: props.workType,
            startDate: props.startDate,
            endDate: props.endDate,
            x: e.point.x,
            y: e.point.y,
          });
        }
      } else {
        setTooltip(null);
      }
    };

    const handleMouseLeave = () => {
      setTooltip(null);
    };

    // Add event listeners
    map.on('mousemove', handleMouseMove);
    map.on('mouseleave', 'projects-fill', handleMouseLeave);
    map.on('mouseleave', 'projects-line', handleMouseLeave);
    map.on('mouseleave', 'projects-point', handleMouseLeave);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseleave', 'projects-fill', handleMouseLeave);
      map.off('mouseleave', 'projects-line', handleMouseLeave);
      map.off('mouseleave', 'projects-point', handleMouseLeave);
    };
  }, [map]);

  if (!tooltip) return null;

  return (
    <div 
      className="project-tooltip"
      style={{
        position: 'absolute',
        left: tooltip.x + 10,
        top: tooltip.y - 10,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
    >
      <div className="tooltip-content">
        <div className="tooltip-header">
          <h4>{tooltip.name}</h4>
          <span className={`tooltip-status status-${tooltip.state}`}>
            {getStateDisplayName(tooltip.state)}
          </span>
        </div>
        <div className="tooltip-body">
          <div className="tooltip-item">
            <strong>Žadatel:</strong> {tooltip.applicant}
          </div>
          <div className="tooltip-item">
            <strong>Typ práce:</strong> {tooltip.workType}
          </div>
          <div className="tooltip-item">
            <strong>Období:</strong> {formatDate(tooltip.startDate)} - {formatDate(tooltip.endDate)}
          </div>
        </div>
        <div className="tooltip-footer">
          <small>Klikněte pro detail</small>
        </div>
      </div>
    </div>
  );
};

export default ProjectTooltip;