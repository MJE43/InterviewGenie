// src/contexts/UserContext.tsx
import React, { createContext, useState, useContext, useMemo } from 'react';
import { User, Session, AppState, GeminiResponse, ContextType, AudioSourceType, AudioStreamType} from '../types/types';

const defaultAppState: AppState = {
  isRecording: false,
  suggestions: [],
  metrics: {},
  errors: null,
  isLoading: false,
};
const defaultContext: ContextType = {
  audioSourceType: "single",
  setAudioSourceType: () => {},
    user: {
        id: 'default-user-id',
        name: 'Default User',
    },
    session: null,
    setSession: () => {},
  appState: defaultAppState,
  setAppState: () => {},
    geminiResponse: null,
    setGeminiResponse: () => {},
    audioStream: null,
    setAudioStream: () => {},
};


const UserContext = createContext<ContextType>(defaultContext);

interface UserContextProviderProps {
  children: React.ReactNode;
}
export const UserContextProvider: React.FC<UserContextProviderProps> = ({ children }) => {
    const [audioSourceType, setAudioSourceType] = useState<AudioSourceType>("single");
    const [user, setUser] = useState<User>({ id: "default-user", name: "Default User" });
    const [session, setSession] = useState<Session | null>(null)
    const [appState, setAppState] = useState<AppState>(defaultAppState);
    const [geminiResponse, setGeminiResponse] = useState<GeminiResponse | null>(null);
    const [audioStream, setAudioStream] = useState<AudioStreamType>(null);

    const contextValue = useMemo(() => ({
        audioSourceType,
        setAudioSourceType,
        user,
        session,
        setSession,
      appState,
      setAppState,
        geminiResponse,
      setGeminiResponse,
        audioStream,
        setAudioStream,
    }), [audioSourceType, user, session, appState, geminiResponse, audioStream]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
