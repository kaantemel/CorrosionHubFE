# Map Component Replacement Guide

This guide explains how to replace the current Leaflet map implementation with ArcGIS or any other mapping solution.

## Architecture Overview

The map component is completely isolated from the rest of the application through a clean interface. This means you can swap it out without touching any other code.

## Current Structure

```
src/components/Map/
├── MapComponent.jsx    # Current implementation (Leaflet)
└── index.js           # Export point (THIS is where you swap)
```

## The Interface Contract

Any replacement map component **must** accept these three props:

### 1. `predictions` (Array)

An array of prediction objects with this structure:

```javascript
[
  {
    location: [longitude, latitude],  // [number, number]
    predicted_corrosion_rate: number, // The corrosion rate value
    data_points_used: number          // Optional: how many data points were used
  },
  // ... more predictions
]
```

**Example:**
```javascript
[
  {
    location: [-98.5795, 39.8283],
    predicted_corrosion_rate: 0.456,
    data_points_used: 150
  }
]
```

### 2. `loading` (Boolean)

Indicates whether data is currently being fetched from the API.

- `true` = Show loading indicator
- `false` = Normal display

### 3. `selectedMetal` (String)

The currently selected metal type. One of:
- `'steel'`
- `'zinc'`
- `'copper'`
- `'aluminium'`

Used for display purposes (e.g., in popups or legends).

## Step-by-Step Replacement

### Step 1: Create Your New Map Component

Create `src/components/Map/ArcGISMapComponent.jsx`:

```jsx
import React from 'react';

/**
 * ArcGIS Map Component
 * Replace this with your actual ArcGIS implementation
 */
const ArcGISMapComponent = ({ predictions = [], loading = false, selectedMetal = 'Steel' }) => {
  
  // Initialize your ArcGIS map here
  // Use predictions array to add markers/heatmap
  // Show loading indicator when loading === true
  // Display selectedMetal in popups/legend
  
  return (
    <div className="relative w-full h-full">
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-lg shadow-lg">
          Loading predictions...
        </div>
      )}
      
      {/* Your ArcGIS map container */}
      <div id="arcgis-map" className="w-full h-full">
        {/* ArcGIS Map View goes here */}
      </div>
      
      {/* Optional: Legend or other overlays */}
    </div>
  );
};

export default ArcGISMapComponent;
```

### Step 2: Update the Export

Open `src/components/Map/index.js` and change **2 lines**:

**Before:**
```javascript
import MapComponent from './MapComponent';
export default MapComponent;
```

**After:**
```javascript
import ArcGISMapComponent from './ArcGISMapComponent';
export default ArcGISMapComponent;
```

### Step 3: Test

That's it! Restart your dev server:

```bash
npm run dev
```

The rest of the application will automatically use your new map component.

## Example: ArcGIS Integration

Here's a skeleton for ArcGIS integration:

```jsx
import React, { useEffect, useRef } from 'react';
import MapView from '@arcgis/core/views/MapView';
import Map from '@arcgis/core/Map';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';

const ArcGISMapComponent = ({ predictions, loading, selectedMetal }) => {
  const mapRef = useRef(null);
  const viewRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    // Initialize map
    const map = new Map({
      basemap: 'streets-vector'
    });

    const view = new MapView({
      container: mapRef.current,
      map: map,
      center: [-98.5795, 39.8283],
      zoom: 4
    });

    const graphicsLayer = new GraphicsLayer();
    map.add(graphicsLayer);

    viewRef.current = view;
    layerRef.current = graphicsLayer;

    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    if (!layerRef.current) return;

    // Clear existing graphics
    layerRef.current.removeAll();

    // Add prediction points
    predictions.forEach(pred => {
      const [lon, lat] = pred.location;
      const rate = pred.predicted_corrosion_rate;

      const point = {
        type: 'point',
        longitude: lon,
        latitude: lat
      };

      const symbol = {
        type: 'simple-marker',
        color: getColor(rate),
        size: '12px',
        outline: {
          color: [255, 255, 255],
          width: 2
        }
      };

      const graphic = new Graphic({
        geometry: point,
        symbol: symbol,
        attributes: {
          metal: selectedMetal,
          rate: rate
        },
        popupTemplate: {
          title: `${selectedMetal} Corrosion`,
          content: `Corrosion Rate: ${rate.toFixed(4)}`
        }
      });

      layerRef.current.add(graphic);
    });
  }, [predictions, selectedMetal]);

  function getColor(rate) {
    if (rate < 0.2) return [0, 255, 0, 0.7];
    if (rate < 0.4) return [127, 255, 0, 0.7];
    if (rate < 0.6) return [255, 255, 0, 0.7];
    if (rate < 0.8) return [255, 127, 0, 0.7];
    return [255, 0, 0, 0.7];
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-lg shadow-lg">
          Loading predictions...
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

export default ArcGISMapComponent;
```

## Important Notes

1. **Don't modify other files**: Only work in `src/components/Map/` directory
2. **Keep the interface**: Your component must accept the same three props
3. **Styling**: Use the full container space (`w-full h-full`)
4. **Z-index**: Use `z-[1000]` or higher for overlays to appear above the map
5. **Cleanup**: Remember to clean up map resources in `useEffect` return

## Testing Your Implementation

After swapping the map:

1. Start the dev server: `npm run dev`
2. Select a metal type from the navigation
3. Choose a date range
4. Click "Fetch Predictions"
5. Verify predictions display correctly on your map
6. Test loading states
7. Test with different metal types

## Rollback

To revert to Leaflet, just change the import in `index.js` back:

```javascript
import MapComponent from './MapComponent';
export default MapComponent;
```

## Questions?

The current Leaflet implementation in `MapComponent.jsx` serves as a complete reference implementation. Study it to see how:
- Predictions are rendered
- Colors are calculated
- Loading states are displayed
- Legends are positioned
- Popups are formatted

Good luck with your ArcGIS integration!

