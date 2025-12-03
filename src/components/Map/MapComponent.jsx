import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

// Component to update map view and add heatmap layer
function MapUpdater({ predictions, heatmapData, showHeatmap, showGrid, hiResPending = false, selectedMetal = 'Steel', onHeatmapRangeChange = () => {} }) {
  const map = useMap();
  const heatLayerRef = useRef(null);
  const gridLayerRef = useRef(null);
  const imageOverlayRef = useRef(null);
  const maskLayerRef = useRef(null);
  const germanyRingsRef = useRef(null); // [[ [lat,lon], ... ], ...]
  
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
  
  // Thresholds per metal for ISO-like bins (C1-C2 ... C5-CX)
  function getMetalThresholds(metal) {
    const m = (metal || 'steel').toLowerCase();
    if (m === 'zinc') return [0.7, 5, 15, 30, 50]; // C5-CX boundary ~50 (CX 50-180), use 50
    if (m === 'copper') return [0.9, 5, 12, 25, 50];
    if (m === 'aluminium' || m === 'aluminum') return [0.6, 2, 5, 10, 12]; // last is upper bound cue
    // Steel (custom scale already used in app)
    return [250, 400, 550, 700, 900];
  }
  function hexToRgba(hex, alpha = 220) {
    const value = hex.replace('#', '');
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    return [r, g, b, alpha];
  }
  // Jet-like color map for raster overlay (blue->green->yellow->red)
  function jetColor(t) {
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const r = clamp(1.5 - Math.abs(4 * t - 3));
    const g = clamp(1.5 - Math.abs(4 * t - 2));
    const b = clamp(1.5 - Math.abs(4 * t - 1));
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
    // Continuous normalization for heatmap (independent of metal)
    const values = points
      .map(p => p.value ?? p.predicted_corrosion_rate ?? p.rate ?? p.corrosion_rate)
      .filter(v => typeof v === 'number' && isFinite(v));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const denom = maxVal - minVal || 1;
    // Draw raw image to an offscreen buffer first
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = width;
    rawCanvas.height = height;
    const rawCtx = rawCanvas.getContext('2d');
    const imageData = rawCtx.createImageData(width, height);
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
      // Continuous blue->red heatmap based on normalized value
      const t = Math.max(0, Math.min(1, (val - minVal) / denom));
      const [rr, gg, bb, aa] = jetColor(t);
      const base = (rIdx * width + cIdx) * 4;
      imageData.data[base] = rr;
      imageData.data[base + 1] = gg;
      imageData.data[base + 2] = bb;
      imageData.data[base + 3] = aa; // alpha
    });
    rawCtx.putImageData(imageData, 0, 0);
    // Final canvas that we may clip with Germany polygon
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const res = estimateGridResolution(points);
    const minLat = lats[0] - res / 2;
    const maxLat = lats[lats.length - 1] + res / 2;
    const minLon = lons[0] - res / 2;
    const maxLon = lons[lons.length - 1] + res / 2;

    // Note: We keep the raster un-clipped to preserve edge pixels.
    // Visual masking (leaflet-mask) hides everything outside Germany.
    // Compute projection helper using Leaflet CRS
    const map = L.map(document.createElement('div')); // temporary map object
    const crs = map.options.crs || L.CRS.EPSG3857;
    const bounds = L.latLngBounds([ [minLat, minLon], [maxLat, maxLon] ]);
    const nw = crs.project(bounds.getNorthWest());
    const se = crs.project(bounds.getSouthEast());
    const widthPx = canvas.width;
    const heightPx = canvas.height;
    const xScale = widthPx / (se.x - nw.x);
    const yScale = heightPx / (nw.y - se.y);

    // Apply Germany polygon clip
    if (germanyRingsRef.current && germanyRingsRef.current.length > 0) {
      ctx.save();
      ctx.beginPath();
      germanyRingsRef.current.forEach(ring => {
        ring.forEach(([lat, lon], idx) => {
          const p = crs.project(L.latLng(lat, lon));
          const x = (p.x - nw.x) * xScale;
          const y = (nw.y - p.y) * yScale;
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
      });
      ctx.closePath();
      ctx.clip();
    }

    // Draw raster only inside clip region
    ctx.drawImage(rawCanvas, 0, 0);
    ctx.restore();

    return {
      url: canvas.toDataURL('image/png'),
      bounds: [[minLat, minLon], [maxLat, maxLon]],
      min: minVal,
      max: maxVal
    };

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
    if (showHeatmap && (hasHiRes || (!hiResPending && predictions && predictions.length > 0))) {
      try {
        console.log('Rendering heat visualization with', hasHiRes ? 'raster overlay (hi-res)' : 'point kernel');
        if (hasHiRes) {
          const raster = buildRasterFromPoints(heatmapData);
          if (raster) {
            imageOverlayRef.current = L.imageOverlay(raster.url, raster.bounds, { opacity: 0.8, interactive: false, pane: 'heat-pane' });
            imageOverlayRef.current.addTo(map);
            try { onHeatmapRangeChange({ min: raster.min, max: raster.max }); } catch (e) {}
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

          try {
            const vals = predictions.map(p => p.predicted_corrosion_rate).filter(v => typeof v === 'number' && isFinite(v));
            if (vals.length) onHeatmapRangeChange({ min: Math.min(...vals), max: Math.max(...vals) });
          } catch (e) {}

          const centerLat = map.getCenter().lat || 0;
          const initialRadius = getPixelRadiusForMeters(map.getZoom(), centerLat, baseHeatRadiusMeters);
          const initialBlur = Math.round(initialRadius * 0.65);
          heatLayerRef.current = L.heatLayer(heatData, {
            radius: initialRadius,
            minOpacity: 0.35,
            max: 1.0,
            gradient: {
              0.0: 'rgba(0, 255, 0, 0)',
              0.2: 'rgba(0, 255, 0, 0.85)',
              0.4: 'rgba(127, 255, 0, 0.9)',
              0.6: 'rgba(255, 255, 0, 0.95)',
              0.8: 'rgba(255, 127, 0, 1)',
              1.0: 'rgba(255, 0, 0, 1)'
            },
            pane: 'heat-pane'
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
            const color = getColorForMetal(selectedMetal, rate);
            const bounds = [
              [lat - half, lon - half],
              [lat + half, lon + half]
            ];
            const rect = L.rectangle(bounds, {
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: 0.5,
              pane: 'grid-pane'
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
            const color = getColorForMetal(selectedMetal, rate);
            const bounds = [
              [lat - halfSizeDeg, lon - halfSizeDeg],
              [lat + halfSizeDeg, lon + halfSizeDeg]
            ];
            const rect = L.rectangle(bounds, {
              stroke: false,
              fill: true,
              fillColor: color,
              fillOpacity: 0.45,
              pane: 'grid-pane'
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
      try { onHeatmapRangeChange(null); } catch (e) {}
    };
  }, [predictions, heatmapData, showHeatmap, showGrid, map]);

  // Apply a visual mask using Germany ADM0 GeoJSON (loaded via URL) and leaflet-mask if available
  useEffect(() => {
    if (!map) return;
    if (maskLayerRef.current) {
      try { map.removeLayer(maskLayerRef.current); } catch (e) {}
      maskLayerRef.current = null;
    }
    const fetchGermanyRings = async () => {
      const localUrl = new URL('../../Germany_ADM0.geojson', import.meta.url).href;
      const candidates = [localUrl, '/Germany_ADM0.geojson', 'https://datahub.io/core/geo-countries/r/countries.geojson'];
      let gj = null;
      for (const url of candidates) {
        try {
          const r = await fetch(url, { cache: 'force-cache' });
          if (!r.ok) continue;
          const j = await r.json();
          if (url.includes('countries.geojson')) {
            gj = j.features?.find(f => (f.properties?.ADMIN || f.properties?.name) === 'Germany') || null;
          } else {
            gj = j;
          }
          if (gj) break;
        } catch (e) {}
      }
      if (!gj) return [];
      const toLatLng = (ring) => ring.map(([lng, lat]) => [lat, lng]);
      const rings = [];
      const geom = gj.type === 'Feature' ? gj.geometry : (gj.type === 'FeatureCollection' ? gj.features?.[0]?.geometry : gj.geometry || gj);
      if (geom?.type === 'Polygon') {
        if (geom.coordinates?.[0]) rings.push(toLatLng(geom.coordinates[0]));
      } else if (geom?.type === 'MultiPolygon') {
        for (const poly of geom.coordinates || []) {
          if (poly?.[0]) rings.push(toLatLng(poly[0]));
        }
      }
      return rings;
    };
    (async () => {
      const rings = await fetchGermanyRings();
      if (!rings || rings.length === 0) return;
      // Persist rings so we can canvas-clip the raster for exact boundary
      germanyRingsRef.current = rings;
      /*      **********  WHITE MASK TO FORCE BORDER **********
      try {
        if (L.mask && typeof L.mask === 'function') {
          maskLayerRef.current = L.mask(rings, { pane: 'mask-pane', opacity: 0, fillOpacity: 1, fillColor: '#ffffff' });
          maskLayerRef.current.addTo(map);
          return;
        }
      } catch (e) {}
      const world = [
        [85, -180],
        [85, 180],
        [-85, 180],
        [-85, -180],
      ];
      try {
        maskLayerRef.current = L.polygon([world, ...rings], {
          stroke: false,
          fill: true,
          fillOpacity: 1.0,
          fillColor: '#ffffff',
          interactive: false,
          pane: 'mask-pane',
          fillRule: 'evenodd'
        });
        maskLayerRef.current.addTo(map);
      } catch (e) {}
      */
    })();
    return () => {
      if (maskLayerRef.current && map) {
        try { map.removeLayer(maskLayerRef.current); } catch (e) {}
        maskLayerRef.current = null;
      }
      germanyRingsRef.current = null;
    };
  }, [map, imageOverlayRef.current]);

  return null;
}

// Legend items per metal type
function getLegendItems(metal) {
  const m = (metal || 'steel').toLowerCase();
  if (m === 'zinc') {
    return [
      { color: '#00ff00', label: 'C1: ≤ 0.7', desc: 'Very Low' },
      { color: '#7fff00', label: 'C2: 0.7–5', desc: 'Low' },
      { color: '#ffff00', label: 'C3: 5–15', desc: 'Medium' },
      { color: '#ff7f00', label: 'C4: 15–30', desc: 'High' },
      { color: '#ff4500', label: 'C5: 30–60', desc: 'Very High' },
      { color: '#8b0000', label: 'CX: 60–180', desc: 'Extreme' }
    ];
  }
  if (m === 'copper') {
    return [
      { color: '#00ff00', label: 'C1: ≤ 0.9', desc: 'Very Low' },
      { color: '#7fff00', label: 'C2: 0.9–5', desc: 'Low' },
      { color: '#ffff00', label: 'C3: 5–12', desc: 'Medium' },
      { color: '#ff7f00', label: 'C4: 12–25', desc: 'High' },
      { color: '#ff4500', label: 'C5: 25–50', desc: 'Very High' },
      { color: '#8b0000', label: 'CX: 50–90', desc: 'Extreme' }
    ];
  }
  if (m === 'steel' || m === 'carbon steel' || m === 'carbonsteel') {
    return [
      { color: '#00ff00', label: 'C1: ≤ 10', desc: 'Very Low' },
      { color: '#7fff00', label: 'C2: 10–200', desc: 'Low' },
      { color: '#ffff00', label: 'C3: 200–400', desc: 'Medium' },
      { color: '#ff7f00', label: 'C4: 400–650', desc: 'High' },
      { color: '#ff4500', label: 'C5: 650–1500', desc: 'Very High' },
      { color: '#8b0000', label: 'CX: 1500–5500', desc: 'Extreme' }
    ];
  }
  if (m === 'aluminium' || m === 'aluminum') {
    return [
      { color: '#00ff00', label: 'C1-C2: < 0.6', desc: 'Very Low-Low' },
      { color: '#7fff00', label: 'C2-C3: 0.6-2', desc: 'Low-Medium' },
      { color: '#ffff00', label: 'C3-C4: 2-5', desc: 'Medium-High' },
      { color: '#ff7f00', label: 'C4-C5: 5-10', desc: 'High-Very High' },
      { color: '#ff0000', label: 'C5-CX: > 10', desc: 'Very High-Extreme' }
    ];
  }
  // Default to steel if unknown
  return [
    { color: '#00ff00', label: 'C1: ≤ 10', desc: 'Very Low' },
    { color: '#7fff00', label: 'C2: 10–200', desc: 'Low' },
    { color: '#ffff00', label: 'C3: 200–400', desc: 'Medium' },
    { color: '#ff7f00', label: 'C4: 400–650', desc: 'High' },
    { color: '#ff4500', label: 'C5: 650–1500', desc: 'Very High' },
    { color: '#8b0000', label: 'CX: 1500–5500', desc: 'Extreme' }
  ];
}

// Get color based on corrosion rate for given metal
function getColorForMetal(metal, rate) {
  const m = (metal || 'steel').toLowerCase();
  // color bins: green, yellow-green, yellow, orange, orange-red, dark red
  const colors = ['#00ff00', '#7fff00', '#ffff00', '#ff7f00', '#ff4500', '#8b0000'];
  const thresholds = (() => {
    if (m === 'zinc') return [0.7, 5, 15, 30, 60, 180];     // upper bounds per class
    if (m === 'copper') return [0.9, 5, 12, 25, 50, 90];
    if (m === 'aluminium' || m === 'aluminum') return [0.6, 2, 5, 10, 12, Number.POSITIVE_INFINITY];
    // steel
    return [10, 200, 400, 650, 1500, 5500];
  })();
  for (let i = 0; i < thresholds.length; i++) {
    if (rate <= thresholds[i]) return colors[i] || colors[colors.length - 1];
  }
  return colors[colors.length - 1];
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
const MapComponent = ({ predictions = [], loading = false, selectedMetal = 'Steel', heatmapData = [], hiResPending = false }) => {
  const defaultCenter = [50, 10]; // Center of Germany (where the data is)
  const defaultZoom = 6;
  const [showHeatmap, setShowHeatmap] = React.useState(true);
  const [showMarkers, setShowMarkers] = React.useState(true); // Show point markers by default
  const [heatRange, setHeatRange] = React.useState(null); // {min, max}
  const [showCategoryLegend, setShowCategoryLegend] = React.useState(true);
  const [showHeatLegend, setShowHeatLegend] = React.useState(true);
  const heatTicks = React.useMemo(() => {
    if (!heatRange || !Number.isFinite(heatRange.min) || !Number.isFinite(heatRange.max)) return [];
    const n = 5; // number of tick labels
    const step = (heatRange.max - heatRange.min) / (n - 1 || 1);
    return Array.from({ length: n }, (_, i) => heatRange.min + i * step);
  }, [heatRange]);
  const markerRendererRef = React.useRef(L.canvas({ pane: 'marker-top', updateWhenZoom: true, padding: 0.1 }));

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
          <div className="text-xs font-bold mb-2 text-gray-700">View Options</div>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-xs font-medium">Density Heatmap</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <span className="text-xs font-medium">Point Markers</span>
            </label>
          </div>
        </div>
      )}
      
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {/* Panes to control z-index ordering */}
        <Pane name="heat-pane" style={{ zIndex: 410 }} />
        <Pane name="grid-pane" style={{ zIndex: 420 }} />
        <Pane name="mask-pane" style={{ zIndex: 640 }} />
        <Pane name="marker-top" style={{ zIndex: 650 }} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater predictions={predictions} heatmapData={heatmapData} showHeatmap={showHeatmap} showGrid={false} hiResPending={hiResPending} selectedMetal={selectedMetal} onHeatmapRangeChange={setHeatRange} />
        
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
            const color = getColorForMetal(selectedMetal, rate);
            const unit = pred.unit || '';
            
            return (
              <CircleMarker
                key={`${lat},${lon}-${rate}`}
                center={[lat, lon]}
                radius={7}
                fillColor={color}
                fillOpacity={0.8}
                color="#fff"
                weight={1.5}
                renderer={markerRendererRef.current}
              >
                <Popup>
                  <div className="text-sm max-w-xs">
                    <div className="font-bold mb-2 capitalize text-base border-b pb-1">{selectedMetal} Corrosion</div>
                    <div className="mb-2">
                      <span className="font-semibold">Rate:</span> {rate.toFixed(2)} {unit}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <div><span className="font-semibold">Location:</span> {lat.toFixed(4)}, {lon.toFixed(4)}</div>
                      {pred.data_points_used && (
                        <div><span className="font-semibold">Data points:</span> {pred.data_points_used}</div>
                      )}
                    </div>
                    {pred.features && Object.keys(pred.features).length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <div className="font-semibold text-xs mb-1 text-gray-700">Environmental Features:</div>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto">
                          {Object.entries(pred.features).map(([key, value]) => (
                            <div key={key} className="text-xs flex justify-between">
                              <span className="text-gray-600 mr-2">{key.replace(/_/g, ' ')}:</span>
                              <span className="font-medium text-gray-800">
                                {typeof value === 'number' ? value.toFixed(3) : value}
                              </span>
                            </div>
                          ))}
                        </div>
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

      {/* Legends (collapsible) */}
      <div className="absolute bottom-6 right-6 space-y-3 z-[1000]">
        {/* Heatmap continuous scale legend */}
        <div className="bg-white rounded-lg shadow-xl border-2 border-gray-200 overflow-hidden min-w-[260px]">
          <button className="w-full text-left px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between" onClick={() => setShowHeatLegend(v => !v)}>
            <span className="text-sm font-bold text-gray-800">Heatmap Scale (g/m²/yr)</span>
            <span className="text-xs text-gray-600">{showHeatLegend ? '▾' : '▸'}</span>
          </button>
          {showHeatLegend && (
            <div className="p-3">
              <div className="h-3 rounded" style={{background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff7f00, #ff0000)'}}></div>
              {heatTicks.length > 0 ? (
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  {heatTicks.map((v, i) => (
                    <span key={i}>{v.toFixed(1)}</span>
                  ))}
                </div>
              ) : (
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Category legend */}
        <div className="bg-white rounded-lg shadow-xl border-2 border-gray-200 overflow-hidden min-w-[260px]">
          <button className="w-full text-left px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between" onClick={() => setShowCategoryLegend(v => !v)}>
            <span className="text-sm font-bold text-gray-800">Corrosivity Category ({String(selectedMetal).charAt(0).toUpperCase() + String(selectedMetal).slice(1)})</span>
            <span className="text-xs text-gray-600">{showCategoryLegend ? '▾' : '▸'}</span>
          </button>
          {showCategoryLegend && (
            <div className="p-4">
              <div className="space-y-2">
                {getLegendItems(selectedMetal).map((item, idx) => (
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
                  Unit: g/m²/yr (ISO 9223)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
