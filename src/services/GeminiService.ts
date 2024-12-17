import { WebSocketErrorEvent } from '@/types/types';

/**
 * Configuration options for GeminiService
 */
interface GeminiServiceOptions {
    model: string;
    apiKey: string;
}

/**
 * Structure for Gemini API responses
 */
interface GeminiResponse {
    text: string;
    isInterrupted: boolean;
}

/**
 * Type definition for parts in Gemini messages
 */
interface GeminiPart {
    text?: string;
    audio?: {
        audio_source: {
            audio_data: {
                mime_type: string;
                data: number[];
            };
        };
    };
}

/**
 * Structure for WebSocket messages from Gemini API
 */
interface GeminiWebSocketMessage {
    BidiGenerateContentServerContent?: {
        model_turn: {
            parts: Array<{ text: string }>;
        };
        interrupted?: boolean;
    };
}

/**
 * Service class for handling Gemini API communication
 */
class GeminiService {
    private ws: WebSocket | null = null;
    private model: string;
    private apiKey: string;
    private audioStream: MediaStream | null = null;
    private audioRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    

    /**
     * Creates a new instance of GeminiService
     * @param options Configuration options for the service
     */
    constructor(options: GeminiServiceOptions) {
        this.model = options.model;
        this.apiKey = options.apiKey;
    }

    /**
     * Establishes WebSocket connection with Gemini API
     * @param onMessage Callback for handling incoming messages
     * @param onError Callback for handling errors
     */
    connect(onMessage: (event: MessageEvent) => void, onError: (error: WebSocketErrorEvent) => void): void {
        if (this.ws) {
            this.close();
        }

        const wsUrl = `wss://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log("Connected to Gemini API");
        };

        this.ws.onmessage = onMessage;

        this.ws.onerror = (event) => {
            console.error("WebSocket error:", event);
            if (event instanceof ErrorEvent) {
                onError({
                    error: new Error(event.message),
                    message: event.message
                });
            } else {
                onError({
                    error: new Error("Unknown WebSocket error"),
                    message: "Unknown WebSocket error"
                });
            }
        };

        this.ws.onclose = () => {
            console.log("Disconnected from Gemini API");
        };
    }

    /**
     * Initiates a new session with specific instructions
     * @param instruction Initial instruction for the session
     * @throws Error if WebSocket is not connected
     */
    async startSession(instruction: string): Promise<void> {
        if (!this.ws) {
            throw new Error("Gemini service not connected");
        }

        const message = {
            "BidiRequest": {
                "input": {
                    "contents": [{
                        "parts": [{
                            "text": instruction
                        }]
                    }]
                },
                "generation_config": {
                    "temperature": 0.4,
                    "top_p": 1,
                    "top_k": 32,
                    "max_output_tokens": 1024
                }
            }
        };

        this.ws.send(JSON.stringify(message));
    }

    /**
     * Processes incoming messages from Gemini API
     * @param event WebSocket message event
     * @returns Processed response or null if invalid
     */
    processGeminiResponse(event: MessageEvent): GeminiResponse | null {
        if (event.data instanceof Blob) {
            console.log("Received blob data, not processing");
            return null;
        }

        try {
            const response = JSON.parse(event.data) as GeminiWebSocketMessage;
            if (response.BidiGenerateContentServerContent?.model_turn) {
                const text = response.BidiGenerateContentServerContent.model_turn.parts
                    .map((part: { text: string }) => part.text)
                    .join('');
                
                const isInterrupted = response.BidiGenerateContentServerContent.interrupted === true;
                return { text, isInterrupted };
            }

            return null;
        } catch (error) {
            console.error("Error parsing message:", error);
            throw new Error(`Error parsing message: ${error}`);
        }
    }

    /**
     * Closes the WebSocket connection
     */
    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Initiates audio recording
     * @param stream MediaStream for audio recording
     * @param audioSourceType Type of audio source ('single' or 'streaming')
     * @throws Error if WebSocket is not connected
     */
    async startRecording(stream: MediaStream, audioSourceType: string): Promise<void> {
        if (!this.ws) {
            throw new Error("Gemini service not connected");
        }

        this.audioStream = stream;
        this.audioRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        this.audioChunks = [];

        this.audioRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.audioRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.audioChunks = [];
            await this.sendAudio(audioBlob, audioSourceType === "streaming");
        };

        this.audioRecorder.start();
    }

    /**
     * Stops audio recording and cleans up resources
     */
    async stopRecording(): Promise<void> {
        if (this.audioRecorder) {
            this.audioRecorder.stop();
            this.audioRecorder = null;
        }

        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
    }

    /**
     * Sends recorded audio to Gemini API
     * @param audioBlob Recorded audio data
     * @param isStreaming Whether this is part of a streaming session
     * @throws Error if WebSocket is not connected
     */
    async sendAudio(audioBlob: Blob, isStreaming = false): Promise<void> {
        if (!this.ws) {
            throw new Error("Gemini service not connected");
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const parts: GeminiPart[] = [{
            audio: {
                audio_source: {
                    audio_data: {
                        mime_type: "audio/webm",
                        data: Array.from(uint8Array)
                    }
                }
            }
        }];

        if (isStreaming) {
            parts.push({ text: "continue" });
        }

        const message = {
            "BidiRequest": {
                "input": {
                    "contents": [{
                        parts
                    }]
                },
                "generation_config": {
                    "temperature": 0.4,
                    "top_p": 1,
                    "top_k": 32,
                    "max_output_tokens": 1024
                }
            }
        };

        this.ws.send(JSON.stringify(message));
    }
}

export default GeminiService;
