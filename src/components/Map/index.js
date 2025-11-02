/**
 * Map Component Export
 * 
 * This file serves as the single point of export for the map component.
 * To swap out the map implementation (e.g., replace Leaflet with ArcGIS):
 * 
 * 1. Create your new map component (e.g., ArcGISMapComponent.jsx) in this directory
 * 2. Ensure it accepts the same props: predictions, loading, selectedMetal
 * 3. Update the import and export below
 * 4. That's it! The rest of the app will work without any changes.
 * 
 * Example:
 * import ArcGISMapComponent from './ArcGISMapComponent';
 * export default ArcGISMapComponent;
 */

import MapComponent from './MapComponent';

export default MapComponent;

