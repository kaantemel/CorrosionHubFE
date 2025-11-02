# Testing Guide

## Quick Test

The app is now configured with working test data!

### Default Test Settings
- **Dates**: November 20-30, 2024 (pre-configured)
- **Location**: Germany region (lat: 47-54, lon: 6-15)
- **Expected Results**: 85 prediction points

### How to Test

1. **Refresh your browser** at `http://localhost:3000`

2. **Quick Test**: Just click "Fetch Predictions" with the default dates and Steel

3. **Full Test**:
   - Click each metal type: Steel, Zinc, Copper, Aluminium
   - For each metal, click "Fetch Predictions"
   - You should see 85 colored markers appear on a map of Germany
   - Click any marker to see detailed corrosion rate information

### What You Should See

✅ **Success Indicators:**
- Loading spinner appears briefly
- Green success message: "Showing 85 predictions for steel"
- Map zooms to Germany region automatically
- Colored markers appear:
  - 🟢 Green = Low corrosion (< 250 g/m²/yr)
  - 🟡 Yellow = Medium corrosion (400-550 g/m²/yr)  
  - 🔴 Red = High corrosion (> 700 g/m²/yr)
- Legend appears in bottom-right corner
- Clicking markers shows popup with rate, location, and data points

### Expected Data

Based on your backend, for **Steel (2024-11-20 to 2024-11-30)**:
- Total locations: 85
- Corrosion rates range: ~160 to ~850 g/m²/yr
- All locations in Germany
- 11 data points used per prediction

### Test Different Metals

Try clicking each metal button and fetching predictions:
- **Steel** - Higher rates in northern Germany
- **Zinc** - Should show different patterns
- **Copper** - Different corrosion characteristics
- **Aluminium** - Different distribution

### Console Logging

Open browser DevTools (F12) to see debug logs:
- API request details
- Response data structure
- Number of predictions
- Any errors

### Troubleshooting

**No markers appear?**
- Check console for errors
- Verify backend is running on port 8000
- Make sure dates are 2024-11-20 to 2024-11-30

**Blank map?**
- Check if internet connection is working (map tiles load from OpenStreetMap)
- Check console for JavaScript errors

**Wrong data?**
- Verify the correct metal type is selected (check the highlighted button)
- Try clicking the metal button again before fetching

## API Response Format

Your backend returns:
```json
{
  "metal_type": "steel",
  "start_date": "2024-11-20",
  "end_date": "2024-11-30",
  "predictions": [
    {
      "location": {
        "latitude": 47.25,
        "longitude": 10.25
      },
      "predicted_corrosion_rate": 428.39,
      "unit": "g/m²/yr",
      "data_points_used": 11
    }
  ],
  "total_locations": 85
}
```

The frontend now correctly handles this format!

## Next Steps

Once testing is successful:
1. Try different date ranges (if your backend has more data)
2. Explore the map - zoom, pan, click markers
3. When ready, follow `MAP_REPLACEMENT_GUIDE.md` to swap in ArcGIS

Enjoy your corrosion prediction app! 🎉

