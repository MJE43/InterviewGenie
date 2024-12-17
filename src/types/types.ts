
export interface User {
  id: string;
  name: string;
  // Other user related properties
}

export interface Session {
    sessionId: string,
    startTime: Date;
    endTime?: Date;
    // other session data
}
export interface AppState {
  isRecording: boolean;
  suggestions: string[];
  metrics: Record<string, number | string>;
  errors: string | null;
    isLoading: boolean;
}
export interface GeminiResponse {
    text: string;
    isInterrupted: boolean
}
export type AudioSourceType = "single" | "multiple";

export type AudioStreamType = MediaStream | null;

export interface ContextType {
    audioSourceType: AudioSourceType,
    setAudioSourceType: (sourceType: AudioSourceType) => void,
    user: User,
    session: Session | null,
    setSession: (session: Session) => void;
    appState: AppState;
    setAppState: (newState: Partial<AppState>) => void;
    geminiResponse: GeminiResponse | null,
    setGeminiResponse: (geminiResponse: GeminiResponse | null) => void;
    audioStream: AudioStreamType,
    setAudioStream: (stream: AudioStreamType) => void;

}

export interface ExtendedMediaStreamConstraints extends MediaStreamConstraints {
  systemAudio?: "include" | "exclude";
  selfBrowserSurface?: "include" | "exclude";
  displaySurface?: "window" | "browser" | "monitor";
}

export interface GeminiWebSocketMessage {
  BidiGenerateContentServerContent?: {
    model_turn: {
      parts: Array<{ text: string }>;
    };
    interrupted?: boolean;
  };
}

export interface WebSocketErrorEvent {
  error: Error;
  message: string;
}
