// src/App.tsx
import React from 'react';
import StatusBar from './components/statusbar';
import CoachingContent from './components/coachingcontent';
import MetricsDisplay from './components/metricsdisplay';
import LoadingSpinner from './components/loadingspinner';
import AudioVisualizer from './components/audiovisualizer';
import { useUser } from './contexts/UserContext';
import useGemini from './hooks/useGemini';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';

const App: React.FC = () => {
    const {appState, connect, startRecording, stopRecording, setAudioSourceType} = useGemini();
    const {isRecording, errors, isLoading} = appState;
    const { setGeminiResponse, geminiResponse, audioSourceType } = useUser();

    const handleAudioSourceTypeChange = (value: string) => {
        setAudioSourceType(value === "multiple" ? "multiple" : "single");
    }
    const handleConnect = async () => {
        setGeminiResponse(null);
        await connect()
    }
    const handleStartRecording = async () => {
         setGeminiResponse(null);
         await startRecording();
    };


  return (
      <div className="relative">
          <div className="flex justify-center p-4">
            <Button onClick={handleConnect} disabled={isLoading}> Connect to Gemini </Button>
             <Select onValueChange={handleAudioSourceTypeChange} value={audioSourceType}>
                 <SelectTrigger className="ml-4 w-[180px]">
                   <SelectValue placeholder="Audio Type"/>
                 </SelectTrigger>
                  <SelectContent>
                     <SelectItem value={"single"}> Single Stream </SelectItem>
                    <SelectItem value={"multiple"}> Multiple Streams </SelectItem>
                    </SelectContent>
                </Select>
          </div>
        {isLoading && <LoadingSpinner/>}
          {errors && <div className="p-4 text-red-600">{errors}</div>}

          <StatusBar isRecording={isRecording} />
          <CoachingContent  suggestions={geminiResponse?.text || ""}/>
          <MetricsDisplay metrics={appState.metrics}/>
          <AudioVisualizer/>
        <div className="fixed bottom-4 right-4">
              {!isRecording ?
                  (<Button onClick={handleStartRecording} disabled={isLoading} > Start Recording </Button>):
                (<Button onClick={stopRecording} disabled={isLoading}> Stop Recording </Button>)}
          </div>
      </div>
  );
};
export default App;
