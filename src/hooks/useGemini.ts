// src/hooks/useGemini.ts
import { useState, useEffect, useCallback } from 'react';
import GeminiService from '../services/GeminiService';
import {  AppState, GeminiResponse, AudioStreamType,  ContextType, AudioSourceType} from '@/types/types';
import { captureMicrophoneAudio, captureSystemAudio, handleSystemError, combineAudioStreams} from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';

const INITIAL_SYSTEM_INSTRUCTION = `You are an AI interview coach and your role is to help the user by providing real-time tips to help them succeed in their interview. You will receive real time audio from the interviewer and the interviewee and should provide relevant advice in real time. The following are some of the tips you should provide:
  - When the interviewer is giving long prompts and instructions, you should summarize what they are saying to help the user digest the question.
  - When the user is asked behavioral questions, you should prompt the user to use the STAR method to answer the questions, or ask for the user to specify a Situation, Task, Action and Result.
  - When the user is struggling to answer questions, provide the user with sample answers and provide tips that they may have missed.
  - You should help the user by keeping track of time, and provide general interview tips.
`;

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
                    await geminiService.startSession(INITIAL_SYSTEM_INSTRUCTION)
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
    const startRecording = useCallback( async () => {
        if (!geminiService) {
            setAppState({ errors: "Gemini service not initialized" });
           return;
        }
        try {
             setAppState({isRecording: true, errors: null});
           setAppState({isLoading: true});
            let stream: AudioStreamType = null;

            if (audioSourceType === "single") {
                stream = await captureSystemAudio(audioSourceType);
            } else {
                const systemAudioStream = await captureSystemAudio(audioSourceType);
                const microphoneStream = await captureMicrophoneAudio();
                 if (systemAudioStream && microphoneStream) {
                      stream = await combineAudioStreams(systemAudioStream, microphoneStream)
                 }
                else {
                   setAppState({ errors: 'Could not capture system audio'});
                    return;
                 }

            }

            if (!stream) {
                setAppState({ errors: 'Could not capture system audio'});
                 return;
            }

            setAudioStream(stream);
            if (audioSourceType === "single") {
              await geminiService.sendMessage(stream, "user");
             } else {
                 await geminiService.sendMessage(stream, "interviewer");
             }
             setAppState({isLoading: false});
           } catch (error) {
               handleSystemError(error);
               setAppState({isLoading: false, errors: 'Error capturing and sending audio. Check if permissions are granted.'});
            }


    }, [geminiService, setAppState, setAudioStream, audioSourceType]);
    const stopRecording = useCallback(() => {
         setAppState({isRecording: false});
       if (geminiService) {
         geminiService.close();
       }

    }, [geminiService, setAppState]);


  const handleGeminiResponse = (event: MessageEvent) => {
        try {
              const response  = geminiService?.processGeminiResponse(event);
               if (response) {
                 setGeminiResponse(response);
               }
         } catch (error) {
            handleSystemError(error);
             setAppState({ errors: 'Error processing Gemini response.' });
        }

  };
    const handleGeminiError = (error: any) => {
          handleSystemError(error);
          setAppState({ errors: 'Error from Gemini API. Check network connection.' });
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
