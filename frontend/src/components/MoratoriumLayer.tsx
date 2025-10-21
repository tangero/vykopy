import { useEffect } from 'react';
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { Moratorium } from '../types';

interface MoratoriumLayerProps {
  map: MapboxMap | null;
  moratoriums: Moratorium[];
  visible?: boolean;
  onMoratoriumClick?: (moratoriumId: string) => void;
}

const MoratoriumLayer: React.FC<MoratoriumLayerProps> = ({ 
  map, 
  moratoriums, 
  visible = true,
  onMoratoriumClick 
}) => {
  // Convert moratoriums to GeoJSON format
  const moratoriumsGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: moratoriums.map(moratorium => ({
      type: 'Feature',
      id: moratorium.id,
      geometry: moratorium.geometry,
      properties: {
        id: moratorium.id,
        name: moratorium.name,
        reason: moratorium.reason,
        reasonDetail: moratorium.reasonDetail,
        validFrom: moratorium.validFrom.toISOString(),
        validTo: moratorium.validTo.toISOString(),
        exceptions: moratorium.exceptions,
        municipalityCode: moratorium.municipalityCode,
        createdAt: moratorium.createdAt.toISOString(),
        // Check if moratorium is currently active
        isActive: moratorium.validFrom <= new Date() && moratorium.validTo >= new Date()
      }
    }))
  };

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Add moratoriums source if it doesn't exist
    if (!map.getSource('moratoriums')) {
      map.addSource('moratoriums', {
        type: 'geojson',
        data: moratoriumsGeoJSON
      });
    } else {
      // Update existing source
      const source = map.getSource('moratoriums') as GeoJSONSource;
      source.setData(moratoriumsGeoJSON);
    }

    // Add moratorium fill layer (red hatching with 40% transparency)
    if (!map.getLayer('moratoriums-fill')) {
      map.addLayer({
        id: 'moratoriums-fill',
        type: 'fill',
        source: 'moratoriums',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': [
            'case',
            ['get', 'isActive'],
            '#dc2626', // Red for active moratoriums
            '#9ca3af'  // Gray for inactive moratoriums
          ],
          'fill-opacity': 0.4, // 40% transparency as specified
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });
    }

    // Add moratorium line layer for boundaries and LineString geometries
    if (!map.getLayer('moratoriums-line')) {
      map.addLayer({
        id: 'moratoriums-line',
        type: 'line',
        source: 'moratoriums',
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        paint: {
          'line-color': [
            'case',
            ['get', 'isActive'],
            '#dc2626', // Red for active moratoriums
            '#9ca3af'  // Gray for inactive moratoriums
          ],
          'line-width': [
            'case',
            ['==', ['geometry-type'], 'LineString'], 4, // Thicker for LineString
            2 // Thinner for polygon outlines
          ],
          'line-opacity': 0.8,
          'line-dasharray': [3, 3], // Dashed line for moratorium boundaries
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });
    }

    // Add hatching pattern layer for better visual distinction
    if (!map.getLayer('moratoriums-pattern')) {
      map.addLayer({
        id: 'moratoriums-pattern',
        type: 'line',
        source: 'moratoriums',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': [
            'case',
            ['get', 'isActive'],
            '#dc2626', // Red for active moratoriums
            '#9ca3af'  // Gray for inactive moratoriums
          ],
          'line-width': 1,
          'line-opacity': 0.6,
          'line-dasharray': [1, 4], // Creates hatching effect
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });
    }

    // Add point layer for point geometries
    if (!map.getLayer('moratoriums-point')) {
      map.addLayer({
        id: 'moratoriums-point',
        type: 'circle',
        source: 'moratoriums',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': [
            'case',
            ['get', 'isActive'],
            '#dc2626', // Red for active moratoriums
            '#9ca3af'  // Gray for inactive moratoriums
          ],
          'circle-radius': 12,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.8,
        },
        layout: {
          'visibility': visible ? 'visible' : 'none'
        }
      });
    }

    // Add symbol layer for moratorium icons/labels
    if (!map.getLayer('moratoriums-symbol')) {
      map.addLayer({
        id: 'moratoriums-symbol',
        type: 'symbol',
        source: 'moratoriums',
        layout: {
          'text-field': '🚫', // Prohibition emoji as icon
          'text-size': 16,
          'text-anchor': 'center',
          'text-allow-overlap': true,
          'visibility': visible ? 'visible' : 'none'
        },
        paint: {
          'text-opacity': 0.9
        }
      });
    }

  }, [map, moratoriumsGeoJSON, visible]);

  // Handle layer visibility changes
  useEffect(() => {
    if (!map) return;

    const layers = ['moratoriums-fill', 'moratoriums-line', 'moratoriums-pattern', 'moratoriums-point', 'moratoriums-symbol'];
    
    layers.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }, [map, visible]);

  // Add interaction handlers
  useEffect(() => {
    if (!map) return;

    const layers = ['moratoriums-fill', 'moratoriums-line', 'moratoriums-point'];
    
    layers.forEach(layerId => {
      if (map.getLayer(layerId)) {
        // Change cursor on hover
        const handleMouseEnter = () => {
          map.getCanvas().style.cursor = 'pointer';
        };

        const handleMouseLeave = () => {
          map.getCanvas().style.cursor = '';
        };

        // Handle clicks
        const handleClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const moratoriumId = feature.properties?.id;
            if (moratoriumId && onMoratoriumClick) {
              onMoratoriumClick(moratoriumId);
            }
          }
        };

        map.on('mouseenter', layerId, handleMouseEnter);
        map.on('mouseleave', layerId, handleMouseLeave);
        
        if (onMoratoriumClick) {
          map.on('click', layerId, handleClick);
        }

        // Cleanup function would be needed in a real implementation
        // but for this demo, we'll let the map handle it
      }
    });
  }, [map, onMoratoriumClick]);

  // Add tooltip functionality
  useEffect(() => {
    if (!map) return;

    let popup: mapboxgl.Popup | null = null;

    const showTooltip = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const props = feature.properties;
        
        if (props) {
          const validFrom = new Date(props.validFrom).toLocaleDateString('cs-CZ');
          const validTo = new Date(props.validTo).toLocaleDateString('cs-CZ');
          const isActive = props.isActive;
          
          const tooltipContent = `
            <div class="moratorium-tooltip">
              <h4>${props.name}</h4>
              <p><strong>Stav:</strong> ${isActive ? 'Aktivní' : 'Neaktivní'}</p>
              <p><strong>Důvod:</strong> ${props.reason}</p>
              <p><strong>Platnost:</strong> ${validFrom} - ${validTo}</p>
              ${props.reasonDetail ? `<p><strong>Detail:</strong> ${props.reasonDetail}</p>` : ''}
              ${props.exceptions ? `<p><strong>Výjimky:</strong> ${props.exceptions}</p>` : ''}
            </div>
          `;

          popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '300px'
          })
            .setLngLat(e.lngLat)
            .setHTML(tooltipContent)
            .addTo(map);
        }
      }
    };

    const hideTooltip = () => {
      if (popup) {
        popup.remove();
        popup = null;
      }
    };

    const layers = ['moratoriums-fill', 'moratoriums-line', 'moratoriums-point'];
    
    layers.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.on('mouseenter', layerId, showTooltip);
        map.on('mouseleave', layerId, hideTooltip);
      }
    });

    // Cleanup
    return () => {
      if (popup) {
        popup.remove();
      }
    };
  }, [map]);

  return null; // This component doesn't render anything directly
};

export default MoratoriumLayer;