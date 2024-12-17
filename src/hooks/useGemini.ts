import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import  GeminiService  from '@/services/GeminiService';
import { WebSocketErrorEvent } from '@/types/types';

const useGemini = () => {
  const [geminiService, setGeminiService] = useState<GeminiService | null>(null);
  const { appState, setAppState, setGeminiResponse, setAudioStream, audioSourceType, setAudioSourceType,  session, setSession} = useUser();

   useEffect(() => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
       if (!apiKey) {
            console.error("No Gemini API key provided");
          return;
        }
     const service = new GeminiService({
         model: 'models/gemini-2.0-flash-exp',
            apiKey: apiKey
     });

         setGeminiService(service)
     return () => {
           service.close();
        }
   }, []);

    const connect = useCallback( async () => {
        if (!geminiService) {
           console.error("Gemini service not connected");
            return;
        }
           try {
               setAppState({isLoading: true})
               await geminiService.connect(handleGeminiResponse, handleGeminiError)

                if (session === null) {
                    const newSession = {
                         sessionId:  crypto.randomUUID(),
                        startTime: new Date(),
                    }
                    await geminiService.startSession("You are an interview coach. Provide feedback on the user's interview performance. Be concise and specific.")
                    setSession(newSession);

                 } else {
                    console.log("reconnected to the existing session");
                }
                setAppState({isLoading: false});
           } catch (error) {
               handleSystemError(error);
                 setAppState({isLoading: false, errors: 'Error connecting to the Gemini API.'});
           }

    }, [geminiService, setAppState, setSession, session]);

    const handleGeminiResponse = (event: MessageEvent) => {
        if (!geminiService) {
            console.error("Gemini service not connected");
            return;
        }
        try {
            const response = geminiService.processGeminiResponse(event);
            if (response) {
                setGeminiResponse(response);
            }
        } catch (error) {
            handleSystemError(error);
            setAppState({errors: 'Error processing Gemini response.'});
        }
    };

    const handleGeminiError = (error: WebSocketErrorEvent) => {
        handleSystemError(error);
        setAppState({errors: 'Error from Gemini API.'});
    };

    const handleSystemError = (error: unknown) => {
        console.error("System error:", error);
    };

    const startRecording = async () => {
        if (!geminiService) {
            console.error("Gemini service not connected");
            return;
        }
        try {
            setAppState({isLoading: true});
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioStream(stream);
            await geminiService.startRecording(stream, audioSourceType);
            setAppState({isRecording: true, isLoading: false});
        } catch (error) {
            handleSystemError(error);
            setAppState({isLoading: false, errors: 'Error starting recording.'});
        }
    };

    const stopRecording = async () => {
        if (!geminiService) {
            console.error("Gemini service not connected");
            return;
        }
        try {
            setAppState({isLoading: true});
            await geminiService.stopRecording();
            setAppState({isRecording: false, isLoading: false});
        } catch (error) {
            handleSystemError(error);
            setAppState({isLoading: false, errors: 'Error stopping recording.'});
        }
    };

  return {
    appState,
    connect,
    startRecording,
    stopRecording,
      setAudioSourceType
  };
};

export default useGemini;
