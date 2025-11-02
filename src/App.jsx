import React, { useState } from 'react';
import axios from 'axios';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import MapComponent from './components/Map';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [selectedMetal, setSelectedMetal] = useState('steel');
  const [predictions, setPredictions] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: '2024-11-20',
    end: '2024-11-30'
  });

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
        const smoothBody = {
          start_date: startDate,
          end_date: endDate,
          metal_type: metal,
          grid_resolution_deg: 0.1,
          min_lon: 5.5,
          max_lon: 15.5,
          min_lat: 47.0,
          max_lat: 55.5,
          method: 'cubic',
          mask_geojson_path: 'de.json',
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
      } catch (smoothErr) {
        console.warn('High-res heatmap fetch failed, falling back to points:', smoothErr);
        setHeatmapData([]);
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
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

