import React from 'react';

const METAL_TYPES = [
  { id: 'steel', label: 'Steel', color: 'bg-gray-600' },
  { id: 'zinc', label: 'Zinc', color: 'bg-blue-500' },
  { id: 'copper', label: 'Copper', color: 'bg-orange-600' },
  { id: 'aluminium', label: 'Aluminium', color: 'bg-slate-400' }
];

const Navigation = ({ selectedMetal, onMetalChange }) => {
  return (
    <nav className="bg-gradient-to-r from-gray-800 to-gray-900 text-white shadow-lg">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Corrosion Prediction</h1>
            <p className="text-xs text-gray-400">Environmental Monitoring System</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {METAL_TYPES.map((metal) => (
            <button
              key={metal.id}
              onClick={() => onMetalChange(metal.id)}
              className={`
                px-4 py-2 rounded-lg font-medium transition-all duration-200
                ${selectedMetal === metal.id 
                  ? `${metal.color} text-white shadow-lg transform scale-105` 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }
              `}
            >
              {metal.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

