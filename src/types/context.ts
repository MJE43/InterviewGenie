// src/types/context.ts

import type { 
  User,
  Session,
  AppState,
  AudioSourceType,
  AudioStreamType
} from './domain';
import type { GeminiResponse } from './gemini';

/**
* Defines the shape of context actions that can be dispatched
*/
export type ContextAction = 
  | { type: 'SET_AUDIO_SOURCE'; payload: AudioSourceType }
  | { type: 'SET_AUDIO_STREAM'; payload: AudioStreamType }
  | { type: 'SET_SESSION'; payload: Session }
  | { type: 'UPDATE_APP_STATE'; payload: Partial<AppState> }
  | { type: 'SET_GEMINI_RESPONSE'; payload: GeminiResponse | null };

/**
* Application-wide context type definition
*/
export interface ContextType {
  // Audio configuration
  audioSourceType: AudioSourceType;
  setAudioSourceType: (sourceType: AudioSourceType) => void;
  audioStream: AudioStreamType;
  setAudioStream: (stream: AudioStreamType) => void;

  // User session management
  user: User;
  session: Session | null;
  setSession: (session: Session) => void;

  // Application state
  appState: AppState;
  setAppState: (newState: Partial<AppState>) => void;

  // Gemini integration
  geminiResponse: GeminiResponse | null;
  setGeminiResponse: (geminiResponse: GeminiResponse | null) => void;
}

/**
* Hook return type for context consumers
*/
export interface UseContextReturn extends ContextType {
  dispatch: (action: ContextAction) => void;
  isInitialized: boolean;
}
