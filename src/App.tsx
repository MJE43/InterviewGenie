import React, { useState } from 'react';
import StatusBar from './components/statusbar';
import CoachingContent from './components/coachingcontent';
import MetricsDisplay from './components/metricsdisplay';
import LoadingSpinner from './components/loadingspinner';
import AudioVisualizer from './components/audiovisualizer';
import { useUser } from './contexts/UserContext';
import { Button } from './components/ui/button';
import useGemini from './hooks/useGemini';

// InterviewCoach/src/App.tsx
const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const { geminiResponse } = useUser();
  useGemini();


  return (
      <div className="relative">
          <div className="flex justify-center p-4">
            <Button > Connect to Gemini </Button>
          </div>
        <LoadingSpinner/>
          <div className="p-4 text-red-600"></div>

          <StatusBar isRecording={isRecording} />
          <CoachingContent  suggestions={geminiResponse?.text || ""}/>
          <MetricsDisplay metrics={{}}/>
          <AudioVisualizer/>
        <div className="fixed bottom-4 right-4">
              {!isRecording ?
                  (<Button onClick={() => setIsRecording(true)} > Start Recording </Button>):
                (<Button onClick={() => setIsRecording(false)}> Stop Recording </Button>)}
          </div>
      </div>
  );
};
export default App;
