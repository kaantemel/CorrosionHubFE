# Heatmap Debug Guide

## Issue: Heatmap Not Reflecting Points

I've enhanced the heatmap with better debugging. Here's how to diagnose and fix:

### Step 1: Check Browser Console

**Refresh the page** and open DevTools (F12). After fetching predictions, you should see:

```
MapComponent render: {predictionsCount: 85, loading: false, ...}
Corrosion rate range: {min: 159.92, max: 852.13, avg: 523.45}
Creating heatmap with 85 predictions
Point: lat=47.25, lon=10.25, rate=428.39, intensity=0.596
Point: lat=48.0, lon=8.0, rate=583.70, intensity=0.930
...
Heatmap data: [[47.25, 10.25, 0.596], [48.0, 8.0, 0.930], ...]
Heatmap layer added successfully
```

### Step 2: Verify Data

**Check these values in console:**
- `predictionsCount` should be 85
- `min` and `max` rates should vary significantly
- `intensity` values should range from ~0.1 to ~1.5

### Step 3: Toggle Options

Try these combinations to see the heatmap:

1. ✅ **Density Heatmap** (checked)
2. ❌ **Point Markers** (unchecked) 
3. ❌ **Dark Map** (unchecked)

**Then try:**
- Zoom OUT to see the full Germany region
- Zoom IN to specific areas with high intensity

### Step 4: Check Intensity Calculation

The new formula is:
```javascript
// Normalize rate to 0-1 based on typical range
normalized = (rate - 150) / (850 - 150)
intensity = max(0.1, min(normalized * 1.5, 1.5))

// Examples:
// rate=150 → normalized=0 → intensity=0.1 (minimum)
// rate=500 → normalized=0.5 → intensity=0.75 (medium)
// rate=850 → normalized=1.0 → intensity=1.5 (maximum)
```

### Step 5: Force Refresh

If heatmap still doesn't show:

1. **Disable** "Density Heatmap" checkbox
2. **Wait 1 second**
3. **Enable** "Density Heatmap" checkbox again
4. Check console for "Creating heatmap..." message

### Step 6: Try Dark Mode

Dark background makes colors more visible:

1. Check **Dark Map** checkbox
2. Keep **Density Heatmap** checked
3. Uncheck **Point Markers**
4. Look for color variations

### Common Issues

#### Issue: Uniform Green Color
**Cause**: All rates are similar (low corrosion)
**Solution**: Check console for rate range. If all rates are < 250, the heatmap will be mostly green.

#### Issue: No Heatmap Visible
**Cause**: Checkbox unchecked or layer not added
**Solution**: 
- Verify checkbox is checked
- Look for "Heatmap layer added successfully" in console
- Try toggling checkbox off/on

#### Issue: Heatmap Doesn't Update When Changing Metals
**Cause**: Layer not being removed/recreated
**Solution**:
- Check console for "Creating heatmap with X predictions"
- Should see this message every time you change metals
- If not, refresh browser

### Debugging Commands

Open console and run:

```javascript
// Check if heatmap layer exists
console.log(window.map); // Should show map object

// Force re-render
document.querySelector('[type="checkbox"]').click();
document.querySelector('[type="checkbox"]').click();
```

### Expected Behavior

**Steel (2024-11-20 to 2024-11-30):**
- Northern Germany: Orange to Red (high rates 700-850)
- Central Germany: Yellow to Orange (medium rates 400-700)
- Southern areas: Green to Yellow (lower rates 150-400)

**The heatmap should:**
- Show smooth color gradient
- Be brighter in high-corrosion areas
- Update when you change metals
- Disappear when you uncheck the option

### Technical Details

**Heatmap Parameters:**
```javascript
{
  radius: 35,        // Heat point radius
  blur: 45,          // Blur amount
  minOpacity: 0.5,   // Minimum visibility
  maxZoom: 15,       // Detail level
  max: 1.0,          // Intensity cap
}
```

**Gradient Stops:**
```
0.0  → Transparent (baseline)
0.15 → Green (C1-C2)
0.3  → Lime (C2-C3)
0.45 → Yellow (C3)
0.6  → Gold (C3-C4)
0.75 → Orange (C4-C5)
0.85 → Red-Orange (C5)
1.0  → Pure Red (CX)
```

### Still Not Working?

If the heatmap still doesn't show properly:

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+F5)
3. **Check if leaflet.heat is loaded**:
   ```javascript
   console.log(L.heatLayer); // Should be a function
   ```
4. **Verify data format**:
   ```javascript
   // In console after fetching:
   console.log(predictions[0]);
   // Should show: {location: {lat: 47.25, lon: 10.25}, predicted_corrosion_rate: 428.39, ...}
   ```

### Next Steps

Once you see the console logs:
1. Share the "Corrosion rate range" values
2. Share any error messages
3. Try toggling the checkboxes
4. Zoom to different levels

This will help identify exactly where the issue is!

