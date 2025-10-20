import React, { useState, useCallback, useMemo } from 'react';
import Map from './Map';
import MapLayerControl from './MapLayerControl';
import ProjectLayer from './ProjectLayer';
import ProjectTooltip from './ProjectTooltip';
import DrawingTools from './DrawingTools';
import type { DrawingMode } from './DrawingTools';
import DrawingToolbar from './DrawingToolbar';
import MapFilters from './MapFilters';
import type { FilterOptions } from './MapFilters';
import GeocodingSearch from './GeocodingSearch';
import { mockProjects } from '../data/mockProjects';
import { validateGeometry } from '../utils/geometryValidator';
import { filterProjects } from '../utils/projectFilters';

// Import specific types from mapbox-gl
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';

interface MapContainerProps {
  onProjectClick?: (projectId: string) => void;
  onGeometryDrawn?: (geometry: GeoJSON.Geometry) => void;
  showDrawingTools?: boolean;
  showFilters?: boolean;
  showSearch?: boolean;
  className?: string;
}

const MapContainer: React.FC<MapContainerProps> = ({ 
  onProjectClick, 
  onGeometryDrawn,
  showDrawingTools = false,
  showFilters = true,
  showSearch = true,
  className = '' 
}) => {
  const [map, setMap] = useState<MapboxMap | null>(null);
  const [layerControlVisible, setLayerControlVisible] = useState(false);
  const [drawingToolsVisible, setDrawingToolsVisible] = useState(showDrawingTools);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  
  // Filter state
  const [filters, setFilters] = useState<FilterOptions>({
    states: [],
    workTypes: [],
    applicants: [],
    dateRange: { startDate: '', endDate: '' },
    searchQuery: ''
  });

  const handleMapLoad = useCallback((mapInstance: MapboxMap) => {
    setMap(mapInstance);
    
    // Add Czech Republic bounds for better UX
    const czechBounds: mapboxgl.LngLatBoundsLike = [
      [12.0, 48.5], // Southwest coordinates
      [18.9, 51.1]  // Northeast coordinates
    ];
    
    mapInstance.setMaxBounds(czechBounds);
    
    // Add sources and layers for projects and moratoriums
    // These will be populated when data is loaded
    mapInstance.on('style.load', () => {
      // Add empty sources that will be populated later
      if (!mapInstance.getSource('projects')) {
        mapInstance.addSource('projects', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      if (!mapInstance.getSource('moratoriums')) {
        mapInstance.addSource('moratoriums', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }
    });
  }, []);

  const handleMapClick = useCallback((_e: MapMouseEvent) => {
    // Project clicks are now handled by ProjectLayer component
    // This can be used for other map interactions if needed
  }, []);

  const toggleLayerControl = () => {
    setLayerControlVisible(!layerControlVisible);
  };

  const toggleDrawingTools = () => {
    setDrawingToolsVisible(!drawingToolsVisible);
    if (!drawingToolsVisible) {
      setDrawingMode('none'); // Reset drawing mode when hiding tools
    }
  };

  const handleGeometryComplete = useCallback((geometry: GeoJSON.Geometry) => {
    // Validate the geometry
    const validation = validateGeometry(geometry);
    
    if (!validation.isValid) {
      console.error('Invalid geometry:', validation.errors);
      alert(`Neplatná geometrie: ${validation.errors.join(', ')}`);
      return;
    }

    if (validation.warnings.length > 0) {
      console.warn('Geometry warnings:', validation.warnings);
    }

    // Use simplified geometry if available
    const finalGeometry = validation.simplifiedGeometry || geometry;
    
    if (onGeometryDrawn) {
      onGeometryDrawn(finalGeometry);
    }
  }, [onGeometryDrawn]);

  const handleClearDrawing = useCallback(() => {
    if (map) {
      const source = map.getSource('drawing');
      if (source) {
        (source as any).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }
    setDrawingMode('none');
  }, [map]);

  // Filter projects based on current filters
  const filteredProjects = useMemo(() => {
    return filterProjects(mockProjects, filters);
  }, [filters]);

  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, []);

  const handleSearch = useCallback((query: string) => {
    console.log('Searching for:', query);
    // Search functionality is handled through filters
  }, []);

  return (
    <div className={`map-container-wrapper ${className}`}>
      <Map 
        onMapLoad={handleMapLoad}
        onMapClick={handleMapClick}
        className="main-map"
      />
      
      {/* Layer control toggle button */}
      <button 
        className="layer-control-toggle"
        onClick={toggleLayerControl}
        title="Mapové vrstvy"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 16l-6-6h12l-6 6z"/>
          <path d="M12 8l-6-6h12l-6 6z"/>
        </svg>
      </button>

      {/* Drawing tools toggle button */}
      {showDrawingTools && (
        <button 
          className="drawing-toolbar-toggle"
          onClick={toggleDrawingTools}
          title="Kreslicí nástroje"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
      )}

      {/* Layer control panel */}
      {layerControlVisible && (
        <div className="layer-control-overlay">
          <MapLayerControl 
            map={map}
            className="layer-control"
          />
          <button 
            className="layer-control-close"
            onClick={() => setLayerControlVisible(false)}
          >
            ×
          </button>
        </div>
      )}

      {/* Project visualization layer */}
      <ProjectLayer 
        map={map}
        projects={filteredProjects}
        onProjectClick={onProjectClick}
      />

      {/* Project tooltips */}
      <ProjectTooltip map={map} />

      {/* Drawing tools */}
      {showDrawingTools && (
        <>
          <DrawingTools
            map={map}
            mode={drawingMode}
            onGeometryComplete={handleGeometryComplete}
            onModeChange={setDrawingMode}
          />
          
          {drawingToolsVisible && (
            <DrawingToolbar
              mode={drawingMode}
              onModeChange={setDrawingMode}
              onClear={handleClearDrawing}
              className="drawing-toolbar"
            />
          )}
        </>
      )}

      {/* Geocoding search */}
      {showSearch && (
        <GeocodingSearch 
          map={map}
          className="map-geocoding-search"
        />
      )}

      {/* Map filters */}
      {showFilters && (
        <MapFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
          className="map-filters-panel"
        />
      )}
    </div>
  );
};

export default MapContainer;