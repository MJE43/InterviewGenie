// src/components/StatusBar.tsx
import React from 'react';

interface StatusBarProps {
  isRecording: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ isRecording }) => {
  return (
    <div className="p-4 bg-gray-100 border-b">
      {isRecording ? "Recording..." : "Ready"}
    </div>
  );
};

export default StatusBar;
