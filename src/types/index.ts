// src/types/index.ts

// Domain and core types
export type {
  User,
  Session,
  AppState,
  AudioSourceType,
  AudioStreamType,
  AudioStats
} from './domain';

// Audio system types
export type {
  AudioStatus,
  AudioErrorType,
  AudioError,
  AudioConfig,
  AudioMetrics,
  AudioData
} from './audio';

// Context and state management
export type {
  ContextType,
  ContextAction,
  UseContextReturn
} from './context';

// Event system types
export type {
  BaseEventMap,
  EventCallback,
  EventHandlerMap,
  Unsubscribe
} from './events';

// Gemini integration types
export type {
  GenerationConfig,
  SessionConfig,
  GeminiResponse,
  GeminiWebSocketMessage,
  WebSocketErrorEvent,
  GeminiConnectionStatus
} from './gemini';
