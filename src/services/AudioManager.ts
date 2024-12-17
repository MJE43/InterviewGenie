// src/services/AudioManager.ts
import { EventDispatcher } from '@/lib/events';
import { 
    AudioConfig, 
    AudioStatus, 
    AudioErrorType, 
    AudioMetrics,
    AudioData,
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

export class AudioManager extends EventDispatcher {
    private static instance: AudioManager;
    private audioContext: AudioContext | null = null;
    private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private stream: MediaStream | null = null;
    private readonly bufferSize = 4096; // ~93ms at 44.1kHz
    private status: AudioStatus = 'inactive';
    private retryCount = 0;
    private readonly maxRetries = 3;
    private currentConfig: AudioConfig;

    private readonly defaultConfig: AudioConfig = {
        sampleRate: 44100,
        echoCancellation: true,
        noiseSuppression: true
    };

    private constructor() {
        super();
        this.handleAudioProcess = this.handleAudioProcess.bind(this);
        this.currentConfig = { ...this.defaultConfig };
    }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public async initialize(config?: Partial<AudioConfig>): Promise<void> {
        try {
            this.currentConfig = {
                ...this.defaultConfig,
                ...config
            };
            
            await this.setupAudioContext();
            await this.setupAudioStream();
            this.setupAudioPipeline();
            this.status = 'active';
            this.emit('statusChange', this.status);
        } catch (error) {
            await this.handleError(error);
        }
    }

    private async setupAudioContext(): Promise<void> {
        try {
            this.audioContext = new AudioContext({
                sampleRate: this.currentConfig.sampleRate,
                latencyHint: 'interactive'
            });
            await this.audioContext.resume();
        } catch (error) {
            this.handleSetupError(error, 'CONTEXT_CREATION_FAILED', 'Failed to create audio context');
        }
    }

    private async setupAudioStream(): Promise<void> {
        try {
            const constraints: ExtendedMediaTrackConstraints = {
                echoCancellation: this.currentConfig.echoCancellation,
                noiseSuppression: this.currentConfig.noiseSuppression,
                sampleRate: this.currentConfig.sampleRate
            };

            const displayMediaOptions = {
                audio: constraints,
                systemAudio: 'include' as const,
                selfBrowserSurface: 'exclude' as const,
                displaySurface: 'window' as const
            };

            this.stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        } catch (error) {
            this.handleSetupError(error, 'STREAM_CREATION_FAILED', 'Failed to create audio stream');
        }
    }

    private handleSetupError(error: unknown, type: AudioErrorType, message: string): never {
        console.error(`${message}:`, error);
        throw new AudioError(type, message, type !== 'CONTEXT_CREATION_FAILED');
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
            1, // Number of input channels
            1  // Number of output channels
        );

        this.processor.onaudioprocess = this.handleAudioProcess;
        this.mediaStreamSource.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    private handleAudioProcess(event: AudioProcessingEvent): void {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        const metrics = this.calculateAudioMetrics(inputData);
        
        const audioData: AudioData = {
            buffer: inputData,
            metrics,
            timestamp: Date.now()
        };

        this.emit('audioData', audioData);
    }

    private calculateAudioMetrics(buffer: Float32Array): AudioMetrics {
        let sum = 0;
        let peak = 0;

        for (let i = 0; i < buffer.length; i++) {
            const absolute = Math.abs(buffer[i]);
            sum += absolute * absolute; // Use squared values for RMS
            peak = Math.max(peak, absolute);
        }

        const rms = Math.sqrt(sum / buffer.length);
        const average = sum / buffer.length;

        return {
            rms,
            peak,
            average,
            clipping: peak > 0.99
        };
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
        } catch (error) {
            await this.handleError(error);
        }
    }

    public async cleanup(): Promise<void> {
        this.removeAllListeners();

        if (this.processor) {
            this.processor.onaudioprocess = null;
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.mediaStreamSource) {
            this.mediaStreamSource.disconnect();
            this.mediaStreamSource = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
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

    public getConfig(): AudioConfig {
        return { ...this.currentConfig };
    }
}

export default AudioManager;
