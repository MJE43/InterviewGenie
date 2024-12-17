// src/services/AudioManager.ts

import { EventEmitter } from 'events';
import { 
    AudioConfig, 
    AudioStatus, 
    AudioErrorType, 
    AudioMetrics,
    ExtendedMediaTrackConstraints 
} from '@/types/audio';

export class AudioError extends Error {
    constructor(
        public type: AudioErrorType,
        message: string,
        public readonly recoverable: boolean = true
    ) {
        super(message);
        this.name = 'AudioError';
    }
}

export class AudioManager extends EventEmitter {
    private static instance: AudioManager;
    private audioContext: AudioContext | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private stream: MediaStream | null = null;
    private readonly bufferSize = 4096;
    private status: AudioStatus = 'inactive';
    private retryCount = 0;
    private readonly maxRetries = 3;
    private readonly defaultConfig: AudioConfig = {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
    };

    private constructor() {
        super();
        this.handleAudioProcess = this.handleAudioProcess.bind(this);

        try {
            this.setupAudioContext();
        } catch (err) {
            throw new AudioError('CONTEXT_CREATION_FAILED', 'Failed to create audio context in constructor', false);
        }
    }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public async initialize(config: Partial<AudioConfig> = {}): Promise<void> {
        try {
            const mergedConfig = { ...this.defaultConfig, ...config };
            await this.setupAudioStream(mergedConfig);
            this.setupAudioPipeline();
            this.status = 'active';
            this.emit('statusChange', this.status);
        } catch (err) {
            await this.handleError(err);
        }
    }

    private setupAudioContext(): void {
        this.audioContext = new AudioContext({
            sampleRate: this.defaultConfig.sampleRate,
            latencyHint: 'interactive'
        });
    }

    private async setupAudioStream(config: AudioConfig): Promise<void> {
        try {
            const constraints: ExtendedMediaTrackConstraints = {
                echoCancellation: config.echoCancellation,
                noiseSuppression: config.noiseSuppression,
                sampleRate: config.sampleRate
            };

            const displayMediaOptions = {
                audio: constraints,
                systemAudio: 'include' as const,
                selfBrowserSurface: 'exclude' as const,
                displaySurface: 'window' as const
            };

            this.stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        } catch (err) {
            throw new AudioError('STREAM_CREATION_FAILED', 'Failed to create audio stream', true);
        }
    }

    private setupAudioPipeline(): void {
        if (!this.audioContext || !this.stream) {
            throw new AudioError(
                'PIPELINE_SETUP_FAILED',
                'Audio context or stream not initialized',
                false
            );
        }

        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(
            this.bufferSize,
            1,
            1
        );

        this.processor.onaudioprocess = this.handleAudioProcess;
        this.mediaStreamSource.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    private handleAudioProcess(event: AudioProcessingEvent): void {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        const metrics: AudioMetrics = {
            rms: 0,
            peak: 0,
            average: 0,
            clipping: false
        };

        this.calculateAudioMetrics(inputData, metrics);
        
        this.emit('audioData', {
            buffer: inputData,
            metrics,
            timestamp: Date.now()
        });
    }

    private calculateAudioMetrics(buffer: Float32Array, metrics: AudioMetrics): void {
        let sum = 0;

        for (let i = 0; i < buffer.length; i++) {
            const absolute = Math.abs(buffer[i]);
            sum += absolute;
            metrics.peak = Math.max(metrics.peak, absolute);
        }

        metrics.average = sum / buffer.length;
        metrics.rms = Math.sqrt(sum / buffer.length);
        metrics.clipping = metrics.peak > 0.99;
    }

    private async handleError(error: unknown): Promise<void> {
        const audioError = error instanceof AudioError ? error : 
            new AudioError('UNKNOWN', 'Unknown audio error');

        this.emit('error', audioError);

        if (audioError.recoverable && this.retryCount < this.maxRetries) {
            this.retryCount++;
            await this.attemptRecovery();
        } else {
            this.status = 'error';
            this.emit('statusChange', this.status);
            throw audioError;
        }
    }

    private async attemptRecovery(): Promise<void> {
        this.status = 'recovering';
        this.emit('statusChange', this.status);

        try {
            await this.cleanup();
            await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
            await this.initialize();
        } catch (err) {
            await this.handleError(err);
        }
    }

    public async cleanup(): Promise<void> {
        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
            this.processor = null;
        }

        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
            this.mediaStreamSource = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.status = 'inactive';
        this.emit('statusChange', this.status);
    }

    public getStatus(): AudioStatus {
        return this.status;
    }

    public isActive(): boolean {
        return this.status === 'active';
    }
}
