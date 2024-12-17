// src/types/audio.d.ts

declare module '@/types/audio' {
    export type AudioStatus = 'inactive' | 'active' | 'recovering' | 'error';

    export type AudioErrorType = 
        | 'CONTEXT_CREATION_FAILED'
        | 'STREAM_CREATION_FAILED'
        | 'PIPELINE_SETUP_FAILED'
        | 'UNKNOWN';

    export interface AudioError extends Error {
        type: AudioErrorType;
        recoverable: boolean;
    }

    export interface AudioConfig {
        echoCancellation: boolean;
        noiseSuppression: boolean;
        sampleRate: number;
    }

    export interface AudioMetrics {
        rms: number;
        peak: number;
        average: number;
        clipping: boolean;
    }

    export interface AudioData {
        buffer: Float32Array;
        metrics: AudioMetrics;
        timestamp: number;
    }

    // Extended MediaTrackConstraints for Screen Capture API
    export interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
        systemAudio?: 'include' | 'exclude';
        selfBrowserSurface?: 'include' | 'exclude';
        displaySurface?: 'window' | 'browser' | 'monitor';
        suppressLocalAudioPlayback?: boolean;
    }
}
