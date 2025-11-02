# Density Heatmap Visualization Guide

## New Features Added ✨

### 1. **Density/Heatmap Layer**
The map now includes a beautiful density heatmap visualization that shows corrosion rate intensity across regions using color gradients.

**Heatmap Color Scale:**
- 🟢 **Green** → Low corrosion rates (safe zones)
- 🟡 **Yellow** → Medium corrosion rates  
- 🟠 **Orange** → High corrosion rates
- 🔴 **Red** → Very high/extreme corrosion rates (danger zones)

### 2. **Auto-Fetch on Metal Change**
When you click a different metal type in the navigation bar, the app now **automatically fetches** new predictions for that metal using your last selected date range.

**How it works:**
1. Click "Fetch Predictions" with Steel (for example)
2. Switch to Zinc by clicking the button
3. Map automatically clears and loads Zinc predictions
4. No need to click "Fetch Predictions" again!

### 3. **View Toggle Controls**
A new control panel in the top-left corner lets you customize your view:
- ☑️ **Density Heatmap** - Toggle the smooth color gradient overlay
- ☑️ **Point Markers** - Toggle individual location markers

**Combinations you can try:**
- **Both enabled** (default) - See heatmap with precise points
- **Heatmap only** - Clean density visualization
- **Markers only** - Traditional point-based view

## ISO 9223 Corrosivity Categories

The legend now shows corrosivity categories based on ISO 9223 standard:

| Category | Rate (g/m²/yr) | Description | Color |
|----------|----------------|-------------|-------|
| **C1** | < 10 | Very low | 🟢 Green |
| **C2** | 10-200 | Low | 🟢 Green |
| **C3** | 200-400 | Medium | 🟡 Yellow |
| **C4** | 400-650 | High | 🟠 Orange |
| **C5** | 650-1500 | Very high | 🔴 Red |
| **CX** | > 1500 | Extreme | 🔴 Red |

*Note: Actual thresholds vary by metal type as per ISO 9223 Table 2*

## Usage Tips

### Quick Comparison Workflow
1. Select Steel and fetch predictions
2. Observe the heatmap pattern
3. Click Zinc - it auto-fetches
4. Compare the density patterns
5. Repeat for Copper and Aluminium

### Best Practices
- **Enable heatmap** to see overall regional trends
- **Enable markers** to get exact location data
- **Disable markers** when viewing large datasets for cleaner heatmap view
- **Click markers** to see precise corrosion rates and data point counts

### Interpreting the Heatmap

**Hot Spots (Red/Orange):**
- High corrosion risk areas
- Consider protective measures
- May indicate coastal or industrial zones

**Cool Spots (Green/Yellow):**
- Lower corrosion risk
- Better environmental conditions
- Often inland or protected areas

## Technical Details

### Heatmap Configuration
- **Radius**: 25 pixels (smooth blending)
- **Blur**: 35 pixels (soft edges)
- **Intensity**: Normalized based on corrosion rate
- **Max Zoom**: Optimized for viewing at zoom level 10

### Performance
- Heatmap renders efficiently even with 100+ points
- Toggle options let you reduce rendering load if needed
- Automatic bounds fitting ensures optimal view

## What Changed Under the Hood

1. **Added `leaflet.heat` library** for density visualization
2. **Enhanced MapUpdater component** with heatmap layer management
3. **Improved state management** in App.jsx:
   - Tracks last used date range
   - Passes metal type to fetch function
   - Clears predictions on metal change
4. **Updated legend** to show ISO 9223 categories
5. **Added view controls** for user customization

## Troubleshooting

**Heatmap not showing?**
- Make sure "Density Heatmap" checkbox is enabled
- Refresh the browser
- Check console for errors

**Auto-fetch not working?**
- Click "Fetch Predictions" at least once first
- Then metal type changes will auto-fetch
- Check console logs to see metal change events

**Performance issues?**
- Disable heatmap or markers if map is slow
- Try zooming in to reduce visible area
- Close other browser tabs

## Future Enhancements

When you switch to ArcGIS, you can:
- Use ArcGIS's native heatmap renderer
- Add more advanced clustering
- Include 3D elevation data
- Add temporal animations

The current implementation serves as a great MVP that you can enhance with ArcGIS's powerful features!

