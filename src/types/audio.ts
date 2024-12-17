// src/types/audio.ts
// src/types/audio.ts

import { BaseEventMap } from './events';

export type AudioStatus = 'inactive' | 'active' | 'recovering' | 'error' | 'initializing';

export type AudioErrorType = 
    | 'CONTEXT_CREATION_FAILED'
    | 'STREAM_CREATION_FAILED'
    | 'PIPELINE_SETUP_FAILED'
    | 'UNKNOWN'
    | 'STREAM_ENDED';

export interface AudioError extends Error {
    type: AudioErrorType;
    recoverable: boolean;
}

export interface AudioConfig {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    sampleRate: number;
    channelCount?: number;
    latencyHint?: AudioContextLatencyCategory;
    autoGainControl?: boolean;
}

export interface AudioMetrics {
    rms: number;
    peak: number;
    average: number;
    clipping: boolean;
    snr?: number;
}

export interface AudioData {
    buffer: Float32Array;
    metrics: AudioMetrics;
    timestamp: number;
    channels: number;
}

// Implement BaseEventMap with string index signature
export interface AudioEventMap extends BaseEventMap {
    statusChange: AudioStatus;
    error: AudioError;
    audioData: AudioData;
    metricsUpdate: AudioMetrics;
    [key: string]: unknown;  // Required to satisfy BaseEventMap constraint
}
