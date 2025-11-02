# How to Use the Corrosion Prediction App

## Starting the Application

1. **Make sure your backend is running** on `http://localhost:8000`

2. **Start the frontend**:
   ```bash
   npm run dev
   ```

3. **Open your browser** to `http://localhost:3000`

## Using the App

### 1. Select a Metal Type

Click one of the four metal buttons in the top navigation bar:
- **Steel** (gray)
- **Zinc** (blue)
- **Copper** (orange)
- **Aluminium** (light gray)

### 2. Choose Date Range

In the left sidebar:
- Select a **Start Date**
- Select an **End Date**
- You'll see the date range summary and number of days

### 3. Fetch Predictions

Click the **"Fetch Predictions"** button

The app will:
- Call your backend API at `POST /predict`
- Send the selected metal type and date range
- Display a loading indicator
- Show the results on the map

### 4. View Results

The map will display:
- **Colored circles** at each prediction location
- **Color coding**:
  - 🟢 Green = Very low corrosion
  - 🟡 Yellow-green = Low corrosion
  - 🟡 Yellow = Medium corrosion
  - 🟠 Orange = High corrosion
  - 🔴 Red = Very high corrosion

Click any circle to see:
- Metal type
- Exact corrosion rate
- Location coordinates
- Number of data points used

### 5. Try Different Combinations

- Switch between metal types to compare corrosion rates
- Adjust date ranges to see trends over time
- The map automatically zooms to fit all prediction points

## Troubleshooting

### "Failed to fetch predictions"

- Make sure your backend is running on `http://localhost:8000`
- Check that the backend has data for your selected date range
- Open browser console (F12) for detailed error messages

### No predictions shown

- Try a different date range
- Verify your backend has data for the selected metal type
- Check the backend response in the browser's Network tab

### Map not loading

- Check your internet connection (map tiles are loaded from OpenStreetMap)
- Clear browser cache and reload
- Check browser console for errors

## API Request Format

When you click "Fetch Predictions", the app sends:

```json
POST http://localhost:8000/predict

{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "metal_type": "steel"
}
```

Expected response:

```json
[
  {
    "location": [-98.5795, 39.8283],
    "predicted_corrosion_rate": 0.456,
    "data_points_used": 150
  }
]
```

## Tips

- **Zoom and pan** the map using your mouse or trackpad
- **Click markers** for detailed information
- **Use the legend** in the bottom-right to understand color coding
- **Watch the loading indicator** to know when data is being fetched
- The app remembers your last selected metal type

Enjoy visualizing your corrosion predictions!

