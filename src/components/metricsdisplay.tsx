// src/components/MetricsDisplay.tsx
import React from 'react';

interface MetricsDisplayProps {
  metrics: Record<string, number | string>;
}

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({ metrics }) => {
  return (
    <div className="p-4 bg-gray-100 border-t">
      {/* Performance metrics will go here */}
      <pre>{JSON.stringify(metrics, null, 2)}</pre>
    </div>
  );
};

export default MetricsDisplay;
