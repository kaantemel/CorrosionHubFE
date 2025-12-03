import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import MapComponent from './components/Map';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [selectedMetal, setSelectedMetal] = useState('steel');
  const [predictions, setPredictions] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [hiResPending, setHiResPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateLimits, setDateLimits] = useState({ min: null, max: null });
  const [germanyBBox, setGermanyBBox] = useState(null); // {minLon,maxLon,minLat,maxLat}
  const [dateRange, setDateRange] = useState({
    start: '2023-07-01',
    end: '2023-07-30'
  });

  // Fetch available date limits from backend
  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const resp = await axios.get(`${API_BASE_URL}/test-mongodb`);
        const oldest = (resp.data?.date_range?.oldest || '').slice(0, 10);
        const newest = (resp.data?.date_range?.newest || '').slice(0, 10);
        if (oldest && newest) {
          setDateLimits({ min: oldest, max: newest });
          // Clamp current selection into limits
          const clamp = (d) => {
            if (!d) return oldest;
            if (d < oldest) return oldest;
            if (d > newest) return newest;
            return d;
          };
          setDateRange(prev => {
            const start = clamp(prev.start);
            const end = clamp(prev.end);
            // Ensure start <= end
            return { start: start > end ? oldest : start, end: end };
          });
        }
      } catch (e) {
        console.warn('Failed to fetch date limits from /test-mongodb', e);
      }
    };
    fetchLimits();
  }, []);

  // Load Germany bounding box once (local file or remote fallback)
  useEffect(() => {
    const loadBBox = async () => {
      const candidates = [
        new URL('./Germany_ADM0.geojson', import.meta.url).href,
        '/Germany_ADM0.geojson',
        'https://datahub.io/core/geo-countries/r/countries.geojson'
      ];
      let gj = null;
      for (const url of candidates) {
        try {
          const r = await axios.get(url);
          const data = r.data;
          if (url.includes('countries.geojson')) {
            gj = data.features?.find(f => (f.properties?.ADMIN || f.properties?.name) === 'Germany') || null;
          } else {
            gj = data;
          }
          if (gj) break;
        } catch (e) {}
      }
      if (!gj) return;
      const geom = gj.type === 'Feature' ? gj.geometry : (gj.type === 'FeatureCollection' ? gj.features?.[0]?.geometry : gj.geometry || gj);
      const coords = [];
      const pushPoly = (poly) => {
        for (const ring of poly) for (const [lng, lat] of ring) coords.push([lat, lng]);
      };
      if (geom?.type === 'Polygon') pushPoly(geom.coordinates || []);
      else if (geom?.type === 'MultiPolygon') for (const poly of geom.coordinates || []) pushPoly(poly);
      if (coords.length) {
        const lats = coords.map(c => c[0]);
        const lons = coords.map(c => c[1]);
        setGermanyBBox({
          minLon: Math.min(...lons),
          maxLon: Math.max(...lons),
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats)
        });
      }
    };
    loadBBox();
  }, []);

  const handleFetchPredictions = async (startDate, endDate, metalType = null) => {
    setLoading(true);
    setError(null);
    
    // Update stored date range
    setDateRange({ start: startDate, end: endDate });
    
    // Use provided metal type or current selectedMetal
    const metal = metalType || selectedMetal;

    console.log('Fetching predictions:', { startDate, endDate, metal });

    try {
      const response = await axios.post(`${API_BASE_URL}/predict`, {
        start_date: startDate,
        end_date: endDate,
        metal_type: metal
      });

      console.log('API Response:', response.data);

      // Handle response format: {predictions: [...], metal_type: "...", ...}
      let predictionsData = [];
      
      if (response.data.predictions && Array.isArray(response.data.predictions)) {
        predictionsData = response.data.predictions;
      } else if (Array.isArray(response.data)) {
        predictionsData = response.data;
      }

      console.log('Number of predictions:', predictionsData.length);

      if (predictionsData.length > 0) {
        setPredictions(predictionsData);
        console.log('Predictions set successfully', predictionsData[0]);
      } else {
        setError('No predictions returned. Please try different dates.');
        setPredictions([]);
      }

      // Fire high-resolution heatmap request in parallel (best-effort)
      try {
        setHiResPending(true);
        const smoothBody = {
          start_date: startDate,
          end_date: endDate,
          metal_type: metal,
          grid_resolution_deg: 0.03,
          min_lon: germanyBBox?.minLon ?? 5.5,
          max_lon: germanyBBox?.maxLon ?? 15.5,
          min_lat: germanyBBox?.minLat ?? 47.0,
          max_lat: germanyBBox?.maxLat ?? 55.5,
          method: 'cubic',
          mask_geojson_path: 'Germany_ADM0.geojson',
          include_nulls: false
        };
        const smoothResp = await axios.post(`${API_BASE_URL}/predict-smooth`, smoothBody);
        let smoothData = [];
        if (Array.isArray(smoothResp.data?.points)) {
          smoothData = smoothResp.data.points;
        } else if (Array.isArray(smoothResp.data?.data)) {
          smoothData = smoothResp.data.data;
        } else if (Array.isArray(smoothResp.data)) {
          smoothData = smoothResp.data;
        }
        setHeatmapData(smoothData);
        setHiResPending(false);
      } catch (smoothErr) {
        console.warn('High-res heatmap fetch failed, falling back to points:', smoothErr);
        setHeatmapData([]);
        setHiResPending(false);
      }
    } catch (err) {
      console.error('Error fetching predictions:', err);
      console.error('Error details:', err.response?.data);
      setError(
        err.response?.data?.detail || 
        err.message ||
        'Failed to fetch predictions. Make sure the backend is running on http://localhost:8000'
      );
      setPredictions([]);
      setHeatmapData([]);
      setHiResPending(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navigation 
        selectedMetal={selectedMetal} 
        onMetalChange={(metal) => {
          console.log('Metal changed to:', metal);
          setSelectedMetal(metal);
          // Clear current predictions while loading new ones
          setPredictions([]);
          // Auto-fetch predictions when metal changes
          if (dateRange.start && dateRange.end) {
            handleFetchPredictions(dateRange.start, dateRange.end, metal);
          }
        }} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          onFetchPredictions={handleFetchPredictions}
          loading={loading}
          minDate={dateLimits.min}
          maxDate={dateLimits.max}
          defaultStart={dateRange.start}
          defaultEnd={dateRange.end}
        />
        
        <main className="flex-1 relative">
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1001] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
          
          {predictions.length === 0 && !loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <svg 
                  className="mx-auto h-16 w-16 text-gray-400 mb-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Predictions Yet
                </h3>
                <p className="text-sm text-gray-600 max-w-sm">
                  Select a metal type, choose your date range, and click "Fetch Predictions" to visualize corrosion rates.
                </p>
              </div>
            </div>
          )}
          
          {(predictions.length > 0 || loading) && (
            <MapComponent 
              predictions={predictions}
              loading={loading}
              selectedMetal={selectedMetal}
              heatmapData={heatmapData}
              hiResPending={hiResPending}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

