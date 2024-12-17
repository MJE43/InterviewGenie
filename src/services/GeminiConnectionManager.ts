// src/services/GeminiConnectionManager.ts

import { EventDispatcher } from '@/lib/events';
import {
    SessionConfig,
    BidiRequest,
    BidiResponse,
    GeminiMessage,
    GeminiConnectionStatus,
    GeminiError,
    GenerationConfig
} from '@/types/gemini';

interface GeminiEventMap {
    statusChange: GeminiConnectionStatus;
    message: GeminiMessage;
    error: GeminiError;
    interrupted: void;
}

export class GeminiConnectionManager extends EventDispatcher<GeminiEventMap> {
    private ws: WebSocket | null = null;
    private status: GeminiConnectionStatus = 'disconnected';
    private messageQueue: BidiRequest[] = [];
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly reconnectBaseDelay = 1000; // 1 second
    private sessionConfig: SessionConfig | null = null;
    private heartbeatInterval: number | null = null;
    private readonly heartbeatDelay = 30000; // 30 seconds

    // Rate limiting
    private readonly maxMessagesPerMinute = 100;
    private readonly messageWindow = 60000; // 1 minute
    private messageTimestamps: number[] = [];

    constructor(
        private readonly apiKey: string,
        private readonly defaultConfig: Partial<GenerationConfig> = {
            temperature: 0.7,
            topP: 1,
            topK: 40,
            maxOutputTokens: 1024
        }
    ) {
        super();
        this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    }

    public async connect(config: SessionConfig): Promise<void> {
        if (this.status === 'connected' || this.status === 'connecting') {
            return;
        }

        this.sessionConfig = {
            ...config,
            generationConfig: {
                ...this.defaultConfig,
                ...config.generationConfig
            }
        };

        this.updateStatus('connecting');

        try {
            await this.establishConnection();
            this.setupHeartbeat();
        } catch (error) {
            await this.handleConnectionError(error);
        }
    }

    private async establishConnection(): Promise<void> {
        if (!this.sessionConfig) {
            throw this.createError('No session configuration provided', false);
        }

        const wsUrl = this.buildWebSocketUrl();

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);
                this.setupWebSocketHandlers(resolve, reject);
            } catch (error) {
                reject(this.createError('Failed to create WebSocket connection', true));
            }
        });
    }

    private buildWebSocketUrl(): string {
        if (!this.sessionConfig) {
            throw this.createError('No session configuration provided', false);
        }

        return `wss://generativelanguage.googleapis.com/v1beta/models/${
            this.sessionConfig.model
        }:streamGenerateContent?key=${this.apiKey}`;
    }

    private setupWebSocketHandlers(
        resolve: () => void,
        reject: (error: GeminiError) => void
    ): void {
        if (!this.ws) return;

        const connectionTimeout = setTimeout(() => {
            reject(this.createError('Connection timeout', true));
            this.cleanup();
        }, 10000);

        this.ws.onopen = () => {
            clearTimeout(connectionTimeout);
            this.onConnectionEstablished();
            resolve();
        };

        this.ws.onclose = this.handleWebSocketClose.bind(this);
        this.ws.onerror = () => {
            clearTimeout(connectionTimeout);
            const error = this.createError('WebSocket error during connection', true);
            this.emit('error', error);
            reject(error);
        };
        this.ws.onmessage = this.handleWebSocketMessage;
    }

    private handleWebSocketMessage(event: MessageEvent): void {
        try {
            const response = JSON.parse(event.data) as BidiResponse;
            
            if (response.BidiGenerateContentServerContent) {
                const { model_turn, interrupted } = response.BidiGenerateContentServerContent;
                
                const message: GeminiMessage = {
                    type: 'text',
                    content: model_turn.parts.map(part => part.text).join(''),
                    timestamp: Date.now()
                };

                this.emit('message', message);
                
                if (interrupted) {
                    this.emit('interrupted', undefined);
                }
            } else if (response.BidiGenerateContentResponse?.code) {
                this.handleResponseError(response.BidiGenerateContentResponse);
            }
        } catch (error) {
            this.emit('error', this.createError('Failed to parse WebSocket message', false));
        }
    }

    private handleWebSocketClose(event: CloseEvent): void {
        const wasConnected = this.status === 'connected';
        this.updateStatus('disconnected');

        if (wasConnected && event.code !== 1000) {
            void this.handleConnectionError(
                this.createError(`WebSocket closed unexpectedly: ${event.reason}`, true)
            );
        }
    }

    private handleResponseError(response: { message: string; code: number }): void {
        const recoverable = response.code >= 500; // Server errors are potentially recoverable
        const error = this.createError(response.message, recoverable);
        error.code = response.code;
        this.emit('error', error);
    }

    private updateStatus(newStatus: GeminiConnectionStatus): void {
        this.status = newStatus;
        this.emit('statusChange', newStatus);
    }

    private onConnectionEstablished(): void {
        this.updateStatus('connected');
        this.reconnectAttempts = 0;
        void this.processMessageQueue();
    }

    private async handleConnectionError(error: unknown): Promise<void> {
        const geminiError = error instanceof Error ? 
            this.createError(error.message, true) : 
            this.createError('Unknown connection error', true);

        this.emit('error', geminiError);

        if (geminiError.recoverable && this.reconnectAttempts < this.maxReconnectAttempts) {
            await this.attemptReconnection();
        } else {
            this.updateStatus('error');
            throw geminiError;
        }
    }

    private async attemptReconnection(): Promise<void> {
        this.updateStatus('reconnecting');

        const delay = Math.min(
            this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts),
            30000 // Max delay of 30 seconds
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        this.reconnectAttempts++;

        try {
            await this.establishConnection();
        } catch (error) {
            await this.handleConnectionError(error);
        }
    }

    private setupHeartbeat(): void {
        this.clearHeartbeat();
        this.heartbeatInterval = window.setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.heartbeatDelay);
    }

    private clearHeartbeat(): void {
        if (this.heartbeatInterval !== null) {
            window.clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    public async sendMessage(request: BidiRequest): Promise<void> {
        if (!this.canSendMessage()) {
            throw this.createError('Rate limit exceeded', false);
        }

        this.messageQueue.push(request);
        await this.processMessageQueue();
    }

    private async processMessageQueue(): Promise<void> {
        if (this.status !== 'connected' || !this.ws || this.messageQueue.length === 0) {
            return;
        }

        while (this.messageQueue.length > 0 && this.canSendMessage()) {
            const request = this.messageQueue.shift();
            if (!request) continue;

            try {
                this.ws.send(JSON.stringify(request));
                this.messageTimestamps.push(Date.now());
            } catch (error) {
                this.messageQueue.unshift(request);
                throw this.createError('Failed to send message', true);
            }
        }
    }

    private canSendMessage(): boolean {
        const now = Date.now();
        this.messageTimestamps = this.messageTimestamps.filter(
            timestamp => now - timestamp < this.messageWindow
        );
        return this.messageTimestamps.length < this.maxMessagesPerMinute;
    }

    private createError(message: string, recoverable: boolean): GeminiError {
        return {
            name: 'GeminiError',
            message,
            recoverable,
            stack: new Error().stack
        };
    }

    public async cleanup(): Promise<void> {
        this.clearHeartbeat();
        this.messageQueue = [];
        this.messageTimestamps = [];

        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close(1000, 'Cleanup requested');
            }
            this.ws = null;
        }

        this.updateStatus('disconnected');
    }

    public getStatus(): GeminiConnectionStatus {
        return this.status;
    }

    public isConnected(): boolean {
        return this.status === 'connected';
    }

    public getQueueLength(): number {
        return this.messageQueue.length;
    }
}

export default GeminiConnectionManager;
