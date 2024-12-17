// src/types/audio.ts

/**
 * Possible states of the audio processing system
 */
export type AudioStatus = 'inactive' | 'active' | 'recovering' | 'error';

/**
 * Enumeration of possible audio system error types
 */
export type AudioErrorType = 
    | 'CONTEXT_CREATION_FAILED'
    | 'STREAM_CREATION_FAILED'
    | 'PIPELINE_SETUP_FAILED'
    | 'UNKNOWN';

/**
 * Extended Error type for audio-specific errors
 */
export interface AudioError extends Error {
    type: AudioErrorType;
    recoverable: boolean;
}

/**
 * Configuration options for the audio processing system
 */
export interface AudioConfig {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    sampleRate: number;
    channelCount?: number;
    latencyHint?: AudioContextLatencyCategory;
    autoGainControl?: boolean;
}

/**
 * Real-time metrics for audio quality monitoring
 */
export interface AudioMetrics {
    /** Root mean square (volume level) */
    rms: number;
    /** Peak amplitude in the current buffer */
    peak: number;
    /** Average amplitude over time */
    average: number;
    /** Indicates if the audio is clipping */
    clipping: boolean;
    /** Signal-to-noise ratio estimate */
    snr?: number;
}

/**
 * Contains audio data and associated metrics
 */
export interface AudioData {
    /** Raw audio buffer data */
    buffer: Float32Array;
    /** Computed metrics for the current buffer */
    metrics: AudioMetrics;
    /** Timestamp when the data was captured */
    timestamp: number;
    /** Number of channels in the buffer */
    channels: number;
}
