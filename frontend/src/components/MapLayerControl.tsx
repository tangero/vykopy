import React, { useState } from 'react';

// Import specific types from mapbox-gl
import type { Map as MapboxMap } from 'mapbox-gl';

interface MapLayer {
  id: string;
  name: string;
  style: string;
  visible: boolean;
}

interface MapLayerControlProps {
  map: MapboxMap | null;
  className?: string;
}

const MapLayerControl: React.FC<MapLayerControlProps> = ({ map, className = '' }) => {
  const [layers, setLayers] = useState<MapLayer[]>([
    {
      id: 'streets',
      name: 'Ulice',
      style: 'mapbox://styles/mapbox/streets-v12',
      visible: true,
    },
    {
      id: 'satellite',
      name: 'Satelitní',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      visible: false,
    },
    {
      id: 'outdoors',
      name: 'Turistická',
      style: 'mapbox://styles/mapbox/outdoors-v12',
      visible: false,
    },
  ]);

  const [overlays, setOverlays] = useState([
    { id: 'projects', name: 'Projekty', visible: true },
    { id: 'moratoriums', name: 'Moratoria', visible: true },
    { id: 'municipalities', name: 'Obce', visible: false },
    { id: 'cadastral', name: 'Katastr', visible: false },
  ]);

  const handleBaseLayerChange = (selectedLayerId: string) => {
    if (!map) return;

    const selectedLayer = layers.find(layer => layer.id === selectedLayerId);
    if (!selectedLayer) return;

    // Update map style
    map.setStyle(selectedLayer.style);

    // Update layer visibility state
    setLayers(layers.map(layer => ({
      ...layer,
      visible: layer.id === selectedLayerId,
    })));
  };

  const handleOverlayToggle = (overlayId: string) => {
    if (!map) return;

    setOverlays(overlays.map(overlay => {
      if (overlay.id === overlayId) {
        const newVisible = !overlay.visible;
        
        // Toggle layer visibility on map
        if (map.getLayer(overlayId)) {
          map.setLayoutProperty(
            overlayId,
            'visibility',
            newVisible ? 'visible' : 'none'
          );
        }

        return { ...overlay, visible: newVisible };
      }
      return overlay;
    }));
  };

  return (
    <div className={`map-layer-control ${className}`}>
      <div className="layer-control-panel">
        <h3>Mapové vrstvy</h3>
        
        <div className="base-layers">
          <h4>Podkladové mapy</h4>
          {layers.map(layer => (
            <label key={layer.id} className="layer-option">
              <input
                type="radio"
                name="baseLayer"
                value={layer.id}
                checked={layer.visible}
                onChange={() => handleBaseLayerChange(layer.id)}
              />
              <span>{layer.name}</span>
            </label>
          ))}
        </div>

        <div className="overlay-layers">
          <h4>Datové vrstvy</h4>
          {overlays.map(overlay => (
            <label key={overlay.id} className="layer-option">
              <input
                type="checkbox"
                checked={overlay.visible}
                onChange={() => handleOverlayToggle(overlay.id)}
              />
              <span>{overlay.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MapLayerControl;