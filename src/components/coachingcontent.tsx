// src/components/CoachingContent.tsx
import React from 'react';

interface CoachingContentProps {
  suggestions: string;
}

const CoachingContent: React.FC<CoachingContentProps> = ({ suggestions }) => {
  return (
    <div className="p-4">
          {suggestions}
    </div>
  );
};

export default CoachingContent;
