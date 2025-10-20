import { useEffect } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';

interface Project {
  id: string;
  name: string;
  state: string;
  geometry: GeoJSON.Geometry;
  properties: {
    applicant: string;
    contractor?: string;
    workType: string;
    startDate: string;
    endDate: string;
    description?: string;
  };
}

interface ProjectLayerProps {
  map: MapboxMap | null;
  projects: Project[];
  onProjectClick?: (projectId: string) => void;
}

const ProjectLayer: React.FC<ProjectLayerProps> = ({ map, projects, onProjectClick }) => {
  // Color mapping for different project states
  const getStateColor = (state: string): string => {
    switch (state) {
      case 'draft':
        return '#757575'; // Gray
      case 'forward_planning':
        return '#2196f3'; // Blue
      case 'pending_approval':
        return '#ff9800'; // Orange
      case 'approved':
        return '#4caf50'; // Green
      case 'in_progress':
        return '#f44336'; // Red
      case 'completed':
        return '#9e9e9e'; // Light gray
      case 'rejected':
        return '#d32f2f'; // Dark red
      case 'cancelled':
        return '#616161'; // Dark gray
      default:
        return '#757575';
    }
  };

  // Convert projects to GeoJSON format
  const projectsGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: projects.map(project => ({
      type: 'Feature',
      id: project.id,
      geometry: project.geometry,
      properties: {
        id: project.id,
        name: project.name,
        state: project.state,
        color: getStateColor(project.state),
        applicant: project.properties.applicant,
        contractor: project.properties.contractor,
        workType: project.properties.workType,
        startDate: project.properties.startDate,
        endDate: project.properties.endDate,
        description: project.properties.description,
      }
    }))
  };

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Update projects source data
    const source = map.getSource('projects') as GeoJSONSource;
    if (source) {
      source.setData(projectsGeoJSON);
    }

    // Add layers if they don't exist
    if (!map.getLayer('projects-fill')) {
      // Polygon fill layer
      map.addLayer({
        id: 'projects-fill',
        type: 'fill',
        source: 'projects',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.6,
        }
      });
    }

    if (!map.getLayer('projects-line')) {
      // Line layer for both LineString geometries and polygon outlines
      map.addLayer({
        id: 'projects-line',
        type: 'line',
        source: 'projects',
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['==', ['geometry-type'], 'LineString'], 4, // Thicker for LineString
            2 // Thinner for polygon outlines
          ],
          'line-opacity': 0.8,
        }
      });
    }

    if (!map.getLayer('projects-point')) {
      // Point layer
      map.addLayer({
        id: 'projects-point',
        type: 'circle',
        source: 'projects',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.8,
        }
      });
    }

    // Add hover effects
    const layers = ['projects-fill', 'projects-line', 'projects-point'];
    
    layers.forEach(layerId => {
      if (map.getLayer(layerId)) {
        // Change cursor on hover
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });

        // Handle clicks
        if (onProjectClick) {
          map.on('click', layerId, (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              const projectId = feature.properties?.id;
              if (projectId) {
                onProjectClick(projectId);
              }
            }
          });
        }
      }
    });

    // Cleanup function - we don't need to clean up here as the effect will re-run
    // when dependencies change and the map will handle layer cleanup automatically
  }, [map, projects, onProjectClick, projectsGeoJSON]);

  // Add conflict highlighting
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Add conflict highlight layer
    if (!map.getLayer('projects-conflict')) {
      map.addLayer({
        id: 'projects-conflict',
        type: 'line',
        source: 'projects',
        filter: ['==', ['get', 'hasConflict'], true],
        paint: {
          'line-color': '#ff5722', // Orange-red for conflicts
          'line-width': 4,
          'line-opacity': 1,
          'line-dasharray': [2, 2], // Dashed line
        }
      });
    }
  }, [map]);

  return null; // This component doesn't render anything directly
};

export default ProjectLayer;