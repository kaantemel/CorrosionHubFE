import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Component to update map view and add heatmap layer
function MapUpdater({ predictions, heatmapData, showHeatmap, showGrid }) {
  const map = useMap();
  const heatLayerRef = useRef(null);
  const gridLayerRef = useRef(null);
  const imageOverlayRef = useRef(null);
  
  // Infer grid resolution (in degrees) from hi-res points
  function estimateGridResolution(points) {
    if (!Array.isArray(points) || points.length < 2) return 0.1;
    const lats = Array.from(new Set(points.map(r => r.lat ?? r.latitude))).sort((a, b) => a - b);
    const lons = Array.from(new Set(points.map(r => r.lon ?? r.lng ?? r.longitude))).sort((a, b) => a - b);
    const latStep = lats.slice(1).reduce((min, v, i) => Math.min(min, Math.abs(v - lats[i])), Number.POSITIVE_INFINITY);
    const lonStep = lons.slice(1).reduce((min, v, i) => Math.min(min, Math.abs(v - lons[i])), Number.POSITIVE_INFINITY);
    const step = Math.min(latStep || 0.1, lonStep || 0.1);
    return Number.isFinite(step) && step > 0 ? step : 0.1;
  }

  // Keep a constant geographic radius across zooms (meters -> pixels)
  const baseHeatRadiusMeters = 25000; // 25 km kernel radius
  function metersPerPixelAtLatitude(zoom, latitude) {
    const earthCircumferenceMeters = 40075016.686;
    return (
      (Math.cos((latitude * Math.PI) / 180) * earthCircumferenceMeters) /
      Math.pow(2, zoom + 8)
    );
  }
  function getPixelRadiusForMeters(zoom, latitude, meters) {
    const mpp = metersPerPixelAtLatitude(zoom, latitude);
    return Math.max(4, Math.round(meters / mpp));
  }
  
  // Jet-like color map for raster overlay
  function jetColor(t) {
    const r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 3)));
    const g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 2)));
    const b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * t - 1)));
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 220];
  }

  function buildRasterFromPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return null;
    const lats = Array.from(new Set(points.map(p => p.lat ?? p.latitude))).sort((a,b)=>a-b);
    const lons = Array.from(new Set(points.map(p => p.lon ?? p.lng ?? p.longitude))).sort((a,b)=>a-b);
    const height = lats.length;
    const width = lons.length;
    if (width === 0 || height === 0) return null;
    const latIndex = new Map(lats.map((v,i)=>[v,i]));
    const lonIndex = new Map(lons.map((v,i)=>[v,i]));
    const values = points
      .map(p => p.value ?? p.predicted_corrosion_rate ?? p.rate ?? p.corrosion_rate)
      .filter(v => typeof v === 'number' && isFinite(v));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const denom = maxVal - minVal || 1;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    // Fill transparent
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i+3] = 0;
    }
    points.forEach(p => {
      const lat = p.lat ?? p.latitude;
      const lon = p.lon ?? p.lng ?? p.longitude;
      const val = p.value ?? p.predicted_corrosion_rate ?? p.rate ?? p.corrosion_rate;
      if (!latIndex.has(lat) || !lonIndex.has(lon) || !Number.isFinite(val)) return;
      const rIdx = height - 1 - latIndex.get(lat); // flip vertically for north-up
      const cIdx = lonIndex.get(lon);
      const t = Math.max(0, Math.min(1, (val - minVal) / denom));
      const [rr, gg, bb, aa] = jetColor(t);
      const base = (rIdx * width + cIdx) * 4;
      imageData.data[base] = rr;
      imageData.data[base + 1] = gg;
      imageData.data[base + 2] = bb;
      imageData.data[base + 3] = aa; // alpha
    });
    ctx.putImageData(imageData, 0, 0);
    const res = estimateGridResolution(points);
    const minLat = lats[0] - res / 2;
    const maxLat = lats[lats.length - 1] + res / 2;
    const minLon = lons[0] - res / 2;
    const maxLon = lons[lons.length - 1] + res / 2;
    return { url: canvas.toDataURL('image/png'), bounds: [[minLat, minLon], [maxLat, maxLon]] };
  }


  useEffect(() => {
    const hasHiRes = Array.isArray(heatmapData) && heatmapData.length > 0;
    if (predictions && predictions.length > 0) {
      try {
        // Calculate bounds from prediction points
        const latitudes = predictions.map(p => {
          if (Array.isArray(p.location)) return p.location[1];
          return p.location.latitude || p.location.lat;
        });
        const longitudes = predictions.map(p => {
          if (Array.isArray(p.location)) return p.location[0];
          return p.location.longitude || p.location.lon;
        });
        
        const bounds = [
          [Math.min(...latitudes), Math.min(...longitudes)],
          [Math.max(...latitudes), Math.max(...longitudes)]
        ];
        
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (err) {
        console.error('Error fitting bounds:', err);
      }
    } else if (hasHiRes) {
      try {
        const lats = heatmapData.map(r => r.lat ?? r.latitude);
        const lons = heatmapData.map(r => r.lon ?? r.lng ?? r.longitude);
        const bounds = [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)]
        ];
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (e) {
        // ignore
      }
    }
  }, [predictions, heatmapData, map]);

  // Update heatmap layer
  useEffect(() => {
    // Remove existing heatmap layer
    if (heatLayerRef.current) {
      try {
        map.removeLayer(heatLayerRef.current);
      } catch (e) {
        console.log('Layer already removed');
      }
      heatLayerRef.current = null;
    }

    // Remove existing raster image overlay
    if (imageOverlayRef.current) {
      try {
        map.removeLayer(imageOverlayRef.current);
      } catch (e) {}
      imageOverlayRef.current = null;
    }

    // Remove existing grid layer
    if (gridLayerRef.current) {
      try {
        map.removeLayer(gridLayerRef.current);
      } catch (e) {
        // already removed
      }
      gridLayerRef.current = null;
    }

    // Add heatmap if enabled: prefer high-res heatmapData; fallback to predictions
    const hasHiRes = Array.isArray(heatmapData) && heatmapData.length > 0;
    if (showHeatmap && (hasHiRes || (predictions && predictions.length > 0))) {
      try {
        console.log('Rendering heat visualization with', hasHiRes ? 'raster overlay (hi-res)' : 'point kernel');
        if (hasHiRes) {
          const raster = buildRasterFromPoints(heatmapData);
          if (raster) {
            imageOverlayRef.current = L.imageOverlay(raster.url, raster.bounds, { opacity: 0.8, interactive: false });
            imageOverlayRef.current.addTo(map);
          }
        } else {
          let heatData = predictions.map(pred => {
            let lat, lon;
            if (Array.isArray(pred.location)) {
              [lon, lat] = pred.location;
            } else if (pred.location && typeof pred.location === 'object') {
              lat = pred.location.latitude || pred.location.lat;
              lon = pred.location.longitude || pred.location.lon;
            }
            const rate = pred.predicted_corrosion_rate;
            let intensity;
            if (rate < 250) intensity = 0.2;
            else if (rate < 400) intensity = 0.4;
            else if (rate < 550) intensity = 0.6;
            else if (rate < 700) intensity = 0.8;
            else intensity = 1.0;
            return [lat, lon, intensity];
          });

          const centerLat = map.getCenter().lat || 0;
          const initialRadius = getPixelRadiusForMeters(map.getZoom(), centerLat, baseHeatRadiusMeters);
          const initialBlur = Math.round(initialRadius * 0.65);
          heatLayerRef.current = L.heatLayer(heatData, {
            radius: initialRadius,
            blur: initialBlur,
            minOpacity: 0.35,
            max: 1.0,
            gradient: {
              0.0: 'rgba(0, 255, 0, 0)',
              0.2: 'rgba(0, 255, 0, 0.85)',
              0.4: 'rgba(127, 255, 0, 0.9)',
              0.6: 'rgba(255, 255, 0, 0.95)',
              0.8: 'rgba(255, 127, 0, 1)',
              1.0: 'rgba(255, 0, 0, 1)'
            }
          }).addTo(map);

          const handleZoomEnd = () => {
            try {
              const z = map.getZoom();
              const lat = map.getCenter().lat || 0;
              const r = getPixelRadiusForMeters(z, lat, baseHeatRadiusMeters);
              const b = Math.round(r * 0.65);
              if (heatLayerRef.current && typeof heatLayerRef.current.setOptions === 'function') {
                heatLayerRef.current.setOptions({ radius: r, blur: b });
              } else if (heatLayerRef.current && heatLayerRef.current.redraw) {
                heatLayerRef.current.options.radius = r;
                heatLayerRef.current.options.blur = b;
                heatLayerRef.current.redraw();
              }
            } catch (e) {}
          };
          map.on('zoomend', handleZoomEnd);
          handleZoomEnd();
          heatLayerRef.current._onZoomEnd = handleZoomEnd;
        }
      } catch (err) {
        console.error('Error creating heatmap:', err);
      }
    }

    // Add grid cells to reflect exact per-cell corrosion values
    if (showGrid) {
      try {
        const layerGroup = L.layerGroup();
        const hasHiRes = Array.isArray(heatmapData) && heatmapData.length > 0;

        if (hasHiRes) {
          const res = estimateGridResolution(heatmapData);
          const half = res / 2;
          heatmapData.forEach(rec => {
            const lat = rec.lat ?? rec.latitude;
            const lon = rec.lon ?? rec.lng ?? rec.longitude;
            const rate = rec.value ?? rec.predicted_corrosion_rate ?? rec.rate ?? rec.corrosion_rate;
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(rate)) return;
            const color = getColor(rate);
            const bounds = [
              [lat - half, lon - half],
              [lat + half, lon + half]
            ];
            const rect = L.rectangle(bounds, {
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: 0.5
            });
            rect.addTo(layerGroup);
          });
          console.log(`Hi-res grid layer added with ${heatmapData.length} cells at ~${res}° resolution`);
        } else if (predictions && predictions.length > 0) {
          const halfSizeDeg = 0.375; // 0.75° grid cell size
          predictions.forEach(pred => {
            let lat, lon;
            if (Array.isArray(pred.location)) {
              [lon, lat] = pred.location;
            } else if (pred.location && typeof pred.location === 'object') {
              lat = pred.location.latitude || pred.location.lat;
              lon = pred.location.longitude || pred.location.lon;
            } else {
              return;
            }
            const rate = pred.predicted_corrosion_rate;
            const color = getColor(rate);
            const bounds = [
              [lat - halfSizeDeg, lon - halfSizeDeg],
              [lat + halfSizeDeg, lon + halfSizeDeg]
            ];
            const rect = L.rectangle(bounds, {
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: 0.45
            });
            rect.addTo(layerGroup);
          });
          console.log('Grid layer added successfully');
        }

        layerGroup.addTo(map);
        gridLayerRef.current = layerGroup;
      } catch (err) {
        console.error('Error creating grid cells:', err);
      }
    }

    return () => {
      if (heatLayerRef.current && map) {
        try {
          map.removeLayer(heatLayerRef.current);
        } catch (e) {
          // Layer may already be removed
        }
        if (heatLayerRef.current._onZoomEnd) {
          try { map.off('zoomend', heatLayerRef.current._onZoomEnd); } catch (e) {}
        }
      }
      if (imageOverlayRef.current && map) {
        try { map.removeLayer(imageOverlayRef.current); } catch (e) {}
      }
      if (gridLayerRef.current && map) {
        try { map.removeLayer(gridLayerRef.current); } catch (e) {}
      }
    };
  }, [predictions, heatmapData, showHeatmap, showGrid, map]);

  return null;
}

// Get color based on corrosion rate (g/m²/yr scale: 100-900+)
function getColor(rate) {
  // Normalize rate: 100-900 range for corrosion rates in g/m²/yr
  if (rate < 250) return '#00ff00'; // Green - low corrosion (C1-C2)
  if (rate < 400) return '#7fff00'; // Yellow-green (C2-C3)
  if (rate < 550) return '#ffff00'; // Yellow (C3-C4)
  if (rate < 700) return '#ff7f00'; // Orange (C4-C5)
  return '#ff0000'; // Red - high corrosion (C5-CX)
}

/**
 * MapComponent - Isolated map visualization component
 * 
 * This component is designed to be easily replaceable with other mapping solutions (e.g., ArcGIS).
 * 
 * Props:
 * @param {Array} predictions - Array of prediction objects with structure:
 *   {
 *     location: [longitude, latitude] or {latitude, longitude},
 *     predicted_corrosion_rate: number,
 *     data_points_used: number (optional)
 *   }
 * @param {boolean} loading - Whether data is currently loading
 * @param {string} selectedMetal - Currently selected metal type
 * 
 * To replace this component:
 * 1. Create a new component with the same prop interface
 * 2. Update the export in src/components/Map/index.js
 * 3. No changes needed elsewhere in the app
 */
const MapComponent = ({ predictions = [], loading = false, selectedMetal = 'Steel', heatmapData = [] }) => {
  const defaultCenter = [50, 10]; // Center of Germany (where the data is)
  const defaultZoom = 6;
  const [showHeatmap, setShowHeatmap] = React.useState(true);
  const [showMarkers, setShowMarkers] = React.useState(false); // Default to heatmap only for better visibility
  const [showGrid, setShowGrid] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);

  // Log for debugging
  useEffect(() => {
    console.log('MapComponent render:', { 
      predictionsCount: predictions.length, 
      loading, 
      selectedMetal,
      firstPrediction: predictions[0],
      showHeatmap,
      showMarkers
    });
    
    if (predictions.length > 0) {
      const rates = predictions.map(p => p.predicted_corrosion_rate);
      console.log('Corrosion rate range:', {
        min: Math.min(...rates),
        max: Math.max(...rates),
        avg: rates.reduce((a, b) => a + b, 0) / rates.length
      });
    }
  }, [predictions, loading, selectedMetal, showHeatmap, showMarkers]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm font-medium">Loading predictions...</span>
          </div>
        </div>
      )}

      {!loading && predictions.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-green-100 px-4 py-2 rounded-lg shadow-lg">
          <span className="text-sm font-medium text-green-800 capitalize">
            Showing {predictions.length} predictions for {selectedMetal}
          </span>
        </div>
      )}

      {/* View Toggle Controls */}
      {(predictions.length > 0 || (Array.isArray(heatmapData) && heatmapData.length > 0)) && (
        <div className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded-lg shadow-lg border-2 border-gray-200">
          <div className="text-xs font-bold mb-2 text-gray-700">🎨 View Options</div>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-xs font-medium">🔥 Density Heatmap</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-xs font-medium">🧊 Grid Cells (exact values)</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-xs font-medium">📍 Point Markers</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-xs font-medium">🌙 Dark Map</span>
            </label>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="text-[10px] text-gray-500">
              💡 Tip: Use dark map for vivid heatmap
            </div>
          </div>
        </div>
      )}
      
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {darkMode ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        
        <MapUpdater predictions={predictions} heatmapData={heatmapData} showHeatmap={showHeatmap} showGrid={showGrid} />
        
        {showMarkers && predictions.map((pred, idx) => {
          try {
            // Handle both array [lon, lat] and object {latitude, longitude} formats
            let lat, lon;
            if (Array.isArray(pred.location)) {
              [lon, lat] = pred.location;
            } else if (pred.location && typeof pred.location === 'object') {
              lat = pred.location.latitude || pred.location.lat;
              lon = pred.location.longitude || pred.location.lon;
            } else {
              console.error('Invalid location format:', pred.location);
              return null;
            }

            const rate = pred.predicted_corrosion_rate;
            const color = getColor(rate);
            const unit = pred.unit || '';
            
            return (
              <CircleMarker
                key={idx}
                center={[lat, lon]}
                radius={6}
                fillColor={color}
                fillOpacity={0.8}
                color="#fff"
                weight={1.5}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-bold mb-1 capitalize">{selectedMetal} Corrosion</div>
                    <div>Rate: <span className="font-semibold">{rate.toFixed(2)} {unit}</span></div>
                    <div className="text-xs text-gray-600 mt-1">
                      Location: {lat.toFixed(4)}, {lon.toFixed(4)}
                    </div>
                    {pred.data_points_used && (
                      <div className="text-xs text-gray-600">
                        Data points: {pred.data_points_used}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          } catch (err) {
            console.error('Error rendering prediction:', pred, err);
            return null;
          }
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-white p-4 rounded-lg shadow-xl z-[1000] border-2 border-gray-200">
        <div className="text-sm font-bold mb-3 text-gray-800 flex items-center">
          <span className="mr-2">📊</span>
          Corrosivity Category
        </div>
        <div className="space-y-2">
          {[
            { color: '#00ff00', label: 'C1-C2: < 250', desc: 'Very Low-Low', icon: '🟢' },
            { color: '#7fff00', label: 'C2-C3: 250-400', desc: 'Low-Medium', icon: '🟡' },
            { color: '#ffff00', label: 'C3-C4: 400-550', desc: 'Medium-High', icon: '🟡' },
            { color: '#ff7f00', label: 'C4-C5: 550-700', desc: 'High-Very High', icon: '🟠' },
            { color: '#ff0000', label: 'C5-CX: > 700', desc: 'Very High-Extreme', icon: '🔴' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded">
              <div 
                className="w-5 h-5 rounded-full border-2 border-gray-400 shadow-sm" 
                style={{ backgroundColor: item.color }}
              ></div>
              <div className="flex flex-col flex-1">
                <span className="text-xs font-semibold text-gray-700">{item.label}</span>
                <span className="text-[10px] text-gray-500">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t-2 border-gray-200">
          <div className="text-[10px] text-gray-600 font-medium">
            📏 Unit: g/m²/yr (ISO 9223)
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
