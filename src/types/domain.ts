// src/types/domain.ts

/**
 * Represents a user in the system.
 * @property id Unique identifier for the user
 * @property name Display name of the user
 */
export interface User {
  id: string;
  name: string;
  email?: string;
  preferences?: Record<string, unknown>;
}

/**
* Represents an interview session.
* @property sessionId Unique identifier for the session
* @property startTime When the session began
* @property endTime Optional completion time
*/
export interface Session {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  userId: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

/**
* Global application state interface.
* Consider breaking into smaller, more focused states as the app grows.
*/
export interface AppState {
  isRecording: boolean;
  suggestions: string[];
  metrics: Record<string, number | string>;
  errors: string | null;
  isLoading: boolean;
}

/**
* Defines the type of audio source configuration.
* - 'single': Single audio source (e.g., microphone)
* - 'multiple': Multiple audio sources (e.g., system audio + mic)
*/
export type AudioSourceType = "single" | "multiple";

/**
* Represents an audio stream or null if no stream is active.
* Using MediaStream from the DOM API.
*/
export type AudioStreamType = MediaStream | null;

/**
* Statistics related to audio processing and quality.
*/
export interface AudioStats {
  sampleRate: number;
  channelCount: number;
  latency: number;
  dropouts: number;
  bufferSize: number;
}
