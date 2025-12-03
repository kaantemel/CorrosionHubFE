import React, { useState, useEffect } from 'react';

const Sidebar = ({ onFetchPredictions, loading, minDate, maxDate, defaultStart, defaultEnd }) => {
  const [startDate, setStartDate] = useState(defaultStart || '2024-11-20');
  const [endDate, setEndDate] = useState(defaultEnd || '2024-11-30');

  useEffect(() => {
    if (defaultStart) setStartDate(defaultStart);
    if (defaultEnd) setEndDate(defaultEnd);
  }, [defaultStart, defaultEnd]);

  const clampToLimits = (d) => {
    if (!d) return d;
    if (minDate && d < minDate) return minDate;
    if (maxDate && d > maxDate) return maxDate;
    return d;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const s = clampToLimits(startDate);
    const eDate = clampToLimits(endDate);
    onFetchPredictions(s, eDate);
  };

  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Prediction Settings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Select date range to predict corrosion rates
        </p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Start Date */}
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={minDate || undefined}
              max={maxDate || undefined}
              lang="en"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={minDate || undefined}
              max={maxDate || undefined}
              lang="en"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          {/* Date Range Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-800">
              <div className="font-semibold mb-1">Selected Range</div>
              <div>
                {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
              </div>
              <div className="mt-1 text-blue-600">
                {Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} days
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-white
              transition-all duration-200
              ${loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:transform active:scale-95 shadow-lg hover:shadow-xl'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Fetching...
              </span>
            ) : (
              'Fetch Predictions'
            )}
          </button>
        </form>
      </div>
    </aside>
  );
};

export default Sidebar;

