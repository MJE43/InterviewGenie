// src/services/AudioManager.ts
import { EventDispatcher } from '@/lib/events';
import { 
    AudioEventMap, 
    AudioStatus, 
    AudioErrorType,
    AudioError as IAudioError,
    AudioConfig,
    AudioData,
    AudioMetrics
} from '@/types/audio';

/**
 * Utility for safe error message extraction with type narrowing
 */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Unknown error occurred';
}

export class AudioError extends Error implements IAudioError {
    constructor(
        public readonly type: AudioErrorType,
        message: string,
        public readonly recoverable: boolean = true
    ) {
        super(message);
        this.name = 'AudioError';
        Object.setPrototypeOf(this, AudioError.prototype);
    }
}

export class AudioManager extends EventDispatcher<AudioEventMap> {
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
        noiseSuppression: true,
        channelCount: 1,
        latencyHint: 'interactive',
        autoGainControl: true
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
        this.currentConfig = { ...this.defaultConfig, ...config };
        this.updateStatus('initializing');

        try {
            await this.setupAudioContext();
            await this.setupAudioStream();
            this.setupAudioPipeline();
            this.updateStatus('active');
        } catch (error) {
            await this.handleError(error);
        }
    }

    private async setupAudioContext(): Promise<void> {
        try {
            this.audioContext = new AudioContext({
                sampleRate: this.currentConfig.sampleRate,
                latencyHint: this.currentConfig.latencyHint
            });
            await this.audioContext.resume();
        } catch (err) {
            const message = getErrorMessage(err);
            throw new AudioError(
                'CONTEXT_CREATION_FAILED',
                `Failed to create audio context: ${message}`,
                false
            );
        }
    }

    private async setupAudioStream(): Promise<void> {
        try {
            const constraints = {
                echoCancellation: this.currentConfig.echoCancellation,
                noiseSuppression: this.currentConfig.noiseSuppression,
                sampleRate: this.currentConfig.sampleRate,
                autoGainControl: this.currentConfig.autoGainControl
            };

            const displayMediaOptions = {
                audio: constraints,
                systemAudio: 'include' as const,
                selfBrowserSurface: 'exclude' as const,
                displaySurface: 'window' as const
            };

            this.stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            this.setupStreamEventHandlers();
        } catch (err) {
            const message = getErrorMessage(err);
            throw new AudioError(
                'STREAM_CREATION_FAILED',
                `Failed to create audio stream: ${message}`,
                true
            );
        }
    }

      public async setupMicrophoneStream(): Promise<void> {
            try {
                const constraints = {
                    echoCancellation: this.currentConfig.echoCancellation,
                    noiseSuppression: this.currentConfig.noiseSuppression,
                };
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
                this.setupStreamEventHandlers();
            } catch (err) {
                 const message = getErrorMessage(err);
                throw new AudioError(
                  'STREAM_CREATION_FAILED',
                    `Failed to create microphone stream: ${message}`,
                  true
                );
            }
     }


    private setupStreamEventHandlers(): void {
        if (!this.stream) return;

        this.stream.getTracks().forEach(track => {
            track.onended = () => {
                if (this.status === 'active') {
                    void this.handleError(new AudioError(
                        'STREAM_ENDED',
                        'Audio stream ended unexpectedly',
                        true
                    ));
                }
            };
        });
    }

    private setupAudioPipeline(): void {
        if (!this.audioContext || !this.stream) {
            throw new AudioError(
                'PIPELINE_SETUP_FAILED',
                'Audio context or stream not initialized',
                false
            );
        }

        try {
            this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.stream);
            this.processor = this.audioContext.createScriptProcessor(
                this.bufferSize,
                this.currentConfig.channelCount ?? 1,
                1
            );

            this.processor.onaudioprocess = this.handleAudioProcess;
            this.mediaStreamSource.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
        } catch (err) {
            const message = getErrorMessage(err);
            throw new AudioError(
                'PIPELINE_SETUP_FAILED',
                `Failed to setup audio processing pipeline: ${message}`,
                false
            );
        }
    }

    private handleAudioProcess(event: AudioProcessingEvent): void {
        if (this.status !== 'active') return;

        try {
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            const metrics = this.calculateAudioMetrics(inputData);
            this.emit('metricsUpdate', metrics);
            
            if (metrics.clipping) {
                console.warn('Audio clipping detected', metrics);
            }
            
            const audioData: AudioData = {
                buffer: inputData,
                metrics,
                timestamp: Date.now(),
                channels: inputBuffer.numberOfChannels
            };

            this.emit('audioData', audioData);
        } catch (err) {
            // Don't throw here to prevent stream interruption
            console.error('Audio processing error:', getErrorMessage(err));
            void this.handleError(new AudioError(
                'UNKNOWN',
                'Error processing audio data',
                true
            ));
        }
    }

    private calculateAudioMetrics(buffer: Float32Array): AudioMetrics {
        let sumSquares = 0;
        let peak = 0;

        for (let i = 0; i < buffer.length; i++) {
            const absolute = Math.abs(buffer[i]);
            sumSquares += absolute * absolute;
            peak = Math.max(peak, absolute);
        }

        const rms = Math.sqrt(sumSquares / buffer.length);
        const average = sumSquares / buffer.length;

        return {
            rms,
            peak,
            average,
            clipping: peak > 0.99,
            snr: this.calculateSNR(rms)
        };
    }

    private calculateSNR(rms: number): number {
        const noiseFloor = 0.0001; // -80dB
        const signalPower = rms * rms;
        const noisePower = noiseFloor * noiseFloor;
        return 10 * Math.log10(signalPower / noisePower);
    }

    private async handleError(error: unknown): Promise<void> {
        const audioError = error instanceof AudioError ? error : 
            new AudioError('UNKNOWN', error instanceof Error ? error.message : 'Unknown audio error');

        this.emit('error', audioError);

        if (audioError.recoverable && this.retryCount < this.maxRetries) {
            this.retryCount++;
            await this.attemptRecovery();
        } else {
            this.updateStatus('error');
            throw audioError;
        }
    }

    private async attemptRecovery(): Promise<void> {
        this.updateStatus('recovering');

        try {
            await this.cleanup();
            // Exponential backoff with jitter
            const delay = (Math.random() * 0.5 + 0.75) * // 75%-125% of base delay
                Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30s
            await new Promise(resolve => setTimeout(resolve, delay));
            await this.initialize(this.currentConfig);
        } catch (error) {
            await this.handleError(error);
        }
    }

    /**
     * Cleans up all audio resources and event listeners
     */
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
                track.onended = null;
                track.stop();
            });
            this.stream = null;
        }

        if (this.audioContext?.state !== 'closed') {
            try {
                await this.audioContext?.close();
            } catch (error) {
                console.warn('Error closing AudioContext:', error);
            }
            this.audioContext = null;
        }

        this.updateStatus('inactive');
        this.retryCount = 0;
    }

     public async startAudio(sourceType: string): Promise<void> {
        try {
            if (sourceType === "single") {
               await this.initialize(this.currentConfig);
            } else {
               await this.initialize(this.currentConfig);
               await this.setupMicrophoneStream();
               this.setupAudioPipeline();
            }

           this.updateStatus('active');
        } catch (error) {
            await this.handleError(error);
        }
    }

    public async stopAudio(): Promise<void> {
           await this.cleanup();
    }
    public getStatus(): AudioStatus {
        return this.status;
    }

    public isActive(): boolean {
        return this.status === 'active';
    }

    public getConfig(): Readonly<AudioConfig> {
        return { ...this.currentConfig };
    }

    private updateStatus(status: AudioStatus): void {
        this.status = status;
        this.emit('statusChange', status);
    }
}

export default AudioManager;
