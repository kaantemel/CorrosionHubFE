# Corrosion Prediction Visualization App

A modern web application for visualizing corrosion rate predictions across different metal types on an interactive map.

## Features

- 🗺️ Interactive map visualization with color-coded corrosion rates
- 🔧 Support for multiple metal types (Steel, Zinc, Copper, Aluminium)
- 📅 Flexible date range selection for predictions
- 🎨 Modern, responsive UI built with React and Tailwind CSS
- 🔄 Swappable map component architecture

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend API running on `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── MapComponent.jsx    # Current map implementation (Leaflet)
│   │   │   └── index.js            # Map component export point
│   │   ├── Navigation.jsx          # Top navigation bar
│   │   └── Sidebar.jsx             # Date picker and controls
│   ├── App.jsx                     # Main application component
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Global styles
├── package.json
└── vite.config.js
```

## Swapping the Map Component

The map component is designed to be easily replaceable. To swap Leaflet for ArcGIS (or any other mapping solution):

### Step 1: Create Your New Map Component

Create a new file `src/components/Map/ArcGISMapComponent.jsx`:

```jsx
const ArcGISMapComponent = ({ predictions, loading, selectedMetal }) => {
  // Your ArcGIS implementation here
  // Use the same props interface as MapComponent.jsx
  
  return (
    <div className="relative w-full h-full">
      {/* Your ArcGIS map */}
    </div>
  );
};

export default ArcGISMapComponent;
```

### Step 2: Update the Export

In `src/components/Map/index.js`, change:

```javascript
import MapComponent from './MapComponent';
export default MapComponent;
```

To:

```javascript
import ArcGISMapComponent from './ArcGISMapComponent';
export default ArcGISMapComponent;
```

### Step 3: Done!

That's it! The rest of the application will work without any changes.

### Map Component Interface

Your replacement map component must accept these props:

- `predictions` (Array): Array of prediction objects with structure:
  ```javascript
  {
    location: [longitude, latitude],
    predicted_corrosion_rate: number,
    data_points_used: number (optional)
  }
  ```
- `loading` (Boolean): Whether data is currently being fetched
- `selectedMetal` (String): Currently selected metal type ('steel', 'zinc', 'copper', 'aluminium')

## API Integration

The app connects to a FastAPI backend with these endpoints:

### POST `/predict`

Request body:
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "metal_type": "steel"
}
```

Response:
```json
[
  {
    "location": [-98.5795, 39.8283],
    "predicted_corrosion_rate": 0.456,
    "data_points_used": 150
  }
]
```

## Technologies Used

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Leaflet & React-Leaflet** - Map visualization (swappable)
- **Axios** - HTTP client

## License

MIT

