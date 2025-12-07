# CorrosionHub Frontend

A geospatial visualization platform for atmospheric corrosion prediction across Germany. Displays machine learning-based corrosion rate forecasts for different metals with interactive heatmaps and detailed environmental feature analysis.

## Overview

CorrosionHub visualizes corrosion predictions based on environmental data including temperature, humidity, rainfall, SO₂ levels, and sea salt concentration. The platform follows ISO 9223 corrosivity classification standards for Steel, Zinc, and Copper.

## Key Features

-  **Interactive Leaflet Maps** - Dual-layer visualization with density heatmaps and point markers
- **High-Resolution Interpolation** - Smooth cubic interpolation at 0.03° grid resolution
-  **Environmental Feature Display** - View 8 environmental parameters influencing each prediction
-  **ISO 9223 Compliance** - Color-coded corrosivity categories (C1-CX) for each metal type
-  **Temporal Analysis** - Flexible date range selection with dynamic data validation
-  **Germany-Focused** - Geographically clipped to German administrative boundaries

## Quick Start

### Prerequisites
- Node.js v16+
- Backend API running at `http://localhost:8000`

### Installation

```bash
npm install
npm run dev
```

Access at `http://localhost:3000`

### Production Build

```bash
npm run build
npm run preview
```

## Supported Metals

| Metal | ISO 9223 Range | Unit |
|-------|----------------|------|
| Steel | C1 (≤10) - CX (1500-5500) | g/m²/yr |
| Zinc | C1 (≤0.7) - CX (60-180) | g/m²/yr |
| Copper | C1 (≤0.9) - CX (50-90) | g/m²/yr |

## API Endpoints

### `POST /predict`
Fetch corrosion predictions for specified date range and metal type.

**Request:**
```json
{
  "start_date": "2024-08-21",
  "end_date": "2024-08-23",
  "metal_type": "zinc"
}
```

**Response:**
```json
{
  "metal_type": "zinc",
  "total_locations": 95,
  "feature_names": ["temp_c", "rainfall_mmyr", "relative_humidity", "time_of_wetness", "so2_ug_m3", "sea_salt_0_03_0_5um_ng_per_kg", "sea_salt_0_5_5um_ng_per_kg", "sea_salt_5_20um_ng_per_kg"],
  "predictions": [
    {
      "location": {"latitude": 47.25, "longitude": 10.25},
      "predicted_corrosion_rate": 4.875,
      "unit": "g/m²/yr",
      "data_points_used": 3,
      "features": {
        "temp_c": 14.003,
        "rainfall_mmyr": 97.333,
        "relative_humidity": 80.867,
        "time_of_wetness": 58.333,
        "so2_ug_m3": 0.353,
        "sea_salt_0_03_0_5um_ng_per_kg": 0.007,
        "sea_salt_0_5_5um_ng_per_kg": 0.529,
        "sea_salt_5_20um_ng_per_kg": 0.011
      }
    }
  ]
}
```

### `POST /predict-smooth`
Fetch high-resolution interpolated heatmap data (0.03° grid).

### `GET /test-mongodb`
Retrieve available date range from database.

## Tech Stack

- **React 18** + **Vite** - Fast, modern frontend framework
- **Leaflet** + **React-Leaflet** - Interactive map rendering
- **Leaflet.heat** - Kernel density heatmap visualization
- **Tailwind CSS** - Utility-first styling
- **Axios** - HTTP client for API communication

## Project Structure

```
src/
├── components/
│   ├── Map/
│   │   ├── MapComponent.jsx    # Leaflet map with heatmap/markers
│   │   └── index.js
│   ├── Navigation.jsx          # Metal type selector
│   └── Sidebar.jsx             # Date range picker
├── App.jsx                     # Main orchestration layer
└── main.jsx
```

## Development

Built with modular, swappable components. The map visualization layer can be replaced by updating `src/components/Map/index.js` to import a different map implementation (e.g., ArcGIS, Mapbox).

## License

MIT

