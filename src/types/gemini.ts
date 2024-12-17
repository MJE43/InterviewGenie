// src/types/gemini.ts

/**
 * Configuration for the Gemini model generation
 */
export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  candidateCount?: number;
}

/**
* Session configuration for Gemini connection
*/
export interface SessionConfig {
  model: string;
  generationConfig?: GenerationConfig;
  systemInstruction?: string;
}

/**
* Structure of a response from the Gemini API
*/
export interface GeminiResponse {
  text: string;
  isInterrupted: boolean;
  timestamp?: number;
  metadata?: {
      tokenCount?: number;
      processingTime?: number;
      modelVersion?: string;
  };
}

/**
* WebSocket message structure for Gemini communication
*/
export interface GeminiWebSocketMessage {
  BidiGenerateContentServerContent?: {
      model_turn: {
          parts: Array<{ text: string }>;
      };
      interrupted?: boolean;
  };
  BidiGenerateContentResponse?: {
      message: string;
      code: number;
  };
}

/**
* WebSocket error event structure
*/
export interface WebSocketErrorEvent {
  error: Error;
  message: string;
  code?: number;
  recoverable?: boolean;
}

/**
* Connection status for the Gemini WebSocket
*/
export type GeminiConnectionStatus = 
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';
