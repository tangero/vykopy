import React, { useEffect, useState, useCallback } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';

export type DrawingMode = 'none' | 'point' | 'line' | 'polygon';

interface DrawingToolsProps {
  map: MapboxMap | null;
  mode: DrawingMode;
  onGeometryComplete?: (geometry: GeoJSON.Geometry) => void;
  onModeChange?: (mode: DrawingMode) => void;
}

interface DrawingState {
  isDrawing: boolean;
  currentGeometry: GeoJSON.Geometry | null;
  coordinates: number[][];
}

const DrawingTools: React.FC<DrawingToolsProps> = ({ 
  map, 
  mode, 
  onGeometryComplete, 
  onModeChange 
}) => {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentGeometry: null,
    coordinates: []
  });

  // Initialize drawing sources and layers
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Add drawing source if it doesn't exist
    if (!map.getSource('drawing')) {
      map.addSource('drawing', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
    }

    // Add drawing layers
    if (!map.getLayer('drawing-fill')) {
      map.addLayer({
        id: 'drawing-fill',
        type: 'fill',
        source: 'drawing',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#007bff',
          'fill-opacity': 0.3
        }
      });
    }

    if (!map.getLayer('drawing-line')) {
      map.addLayer({
        id: 'drawing-line',
        type: 'line',
        source: 'drawing',
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        paint: {
          'line-color': '#007bff',
          'line-width': 3,
          'line-opacity': 0.8
        }
      });
    }

    if (!map.getLayer('drawing-point')) {
      map.addLayer({
        id: 'drawing-point',
        type: 'circle',
        source: 'drawing',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': '#007bff',
          'circle-radius': 6,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });
    }

    // Add vertices layer for editing
    if (!map.getLayer('drawing-vertices')) {
      map.addLayer({
        id: 'drawing-vertices',
        type: 'circle',
        source: 'drawing',
        filter: ['==', ['get', 'type'], 'vertex'],
        paint: {
          'circle-color': '#ffffff',
          'circle-radius': 4,
          'circle-stroke-color': '#007bff',
          'circle-stroke-width': 2
        }
      });
    }
  }, [map]);

  // Update drawing data
  const updateDrawingSource = useCallback((geometry: GeoJSON.Geometry | null, vertices: number[][] = []) => {
    if (!map) return;

    const source = map.getSource('drawing') as GeoJSONSource;
    if (!source) return;

    const features: GeoJSON.Feature[] = [];

    // Add main geometry
    if (geometry) {
      features.push({
        type: 'Feature',
        geometry,
        properties: {}
      });
    }

    // Add vertex points for editing
    vertices.forEach((coord, index) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coord
        },
        properties: {
          type: 'vertex',
          index
        }
      });
    });

    source.setData({
      type: 'FeatureCollection',
      features
    });
  }, [map]);

  // Handle map clicks for drawing
  useEffect(() => {
    if (!map || mode === 'none') return;

    const handleMapClick = (e: any) => {
      const coords = [e.lngLat.lng, e.lngLat.lat];

      if (mode === 'point') {
        const geometry: GeoJSON.Point = {
          type: 'Point',
          coordinates: coords
        };
        
        updateDrawingSource(geometry);
        
        if (onGeometryComplete) {
          onGeometryComplete(geometry);
        }
        
        // Reset mode after completing point
        if (onModeChange) {
          onModeChange('none');
        }
        return;
      }

      if (mode === 'line' || mode === 'polygon') {
        setDrawingState(prev => {
          const newCoords = [...prev.coordinates, coords];
          
          let geometry: GeoJSON.Geometry;
          if (mode === 'line') {
            geometry = {
              type: 'LineString',
              coordinates: newCoords
            };
          } else {
            // For polygon, we need at least 3 points to close
            if (newCoords.length >= 3) {
              const closedCoords = [...newCoords, newCoords[0]]; // Close the polygon
              geometry = {
                type: 'Polygon',
                coordinates: [closedCoords]
              };
            } else {
              geometry = {
                type: 'LineString',
                coordinates: newCoords
              };
            }
          }

          updateDrawingSource(geometry, newCoords);

          return {
            ...prev,
            isDrawing: true,
            currentGeometry: geometry,
            coordinates: newCoords
          };
        });
      }
    };

    // Handle double-click to finish drawing
    const handleDoubleClick = (e: any) => {
      e.preventDefault();
      
      if ((mode === 'line' || mode === 'polygon') && drawingState.coordinates.length >= 2) {
        let finalGeometry: GeoJSON.Geometry;
        
        if (mode === 'line') {
          finalGeometry = {
            type: 'LineString',
            coordinates: drawingState.coordinates
          };
        } else {
          // Close polygon
          const closedCoords = [...drawingState.coordinates, drawingState.coordinates[0]];
          finalGeometry = {
            type: 'Polygon',
            coordinates: [closedCoords]
          };
        }

        if (onGeometryComplete) {
          onGeometryComplete(finalGeometry);
        }

        // Reset drawing state
        setDrawingState({
          isDrawing: false,
          currentGeometry: null,
          coordinates: []
        });

        // Clear drawing source
        updateDrawingSource(null);

        // Reset mode
        if (onModeChange) {
          onModeChange('none');
        }
      }
    };

    // Handle escape key to cancel drawing
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cancel current drawing
        setDrawingState({
          isDrawing: false,
          currentGeometry: null,
          coordinates: []
        });
        
        updateDrawingSource(null);
        
        if (onModeChange) {
          onModeChange('none');
        }
      }
    };

    // Add event listeners
    map.on('click', handleMapClick);
    map.on('dblclick', handleDoubleClick);
    document.addEventListener('keydown', handleKeyDown);

    // Change cursor when in drawing mode
    if (mode === 'point' || mode === 'line' || mode === 'polygon') {
      map.getCanvas().style.cursor = 'crosshair';
    }

    return () => {
      map.off('click', handleMapClick);
      map.off('dblclick', handleDoubleClick);
      document.removeEventListener('keydown', handleKeyDown);
      
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
    };
  }, [map, mode, drawingState.coordinates, updateDrawingSource, onGeometryComplete, onModeChange]);

  // Clear drawing when mode changes to 'none'
  useEffect(() => {
    if (mode === 'none') {
      setDrawingState({
        isDrawing: false,
        currentGeometry: null,
        coordinates: []
      });
      updateDrawingSource(null);
    }
  }, [mode, updateDrawingSource]);

  return null; // This component doesn't render anything directly
};

export default DrawingTools;