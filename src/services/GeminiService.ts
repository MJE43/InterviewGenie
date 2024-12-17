// src/services/GeminiService.ts
import { WebSocketErrorEvent } from '@/types/gemini';
import { GeminiResponse } from '@/types/gemini';

/**
 * Configuration options for GeminiService
 */
interface GeminiServiceOptions {
    model: string;
    apiKey: string;
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
    BidiGenerateContentResponse?: {
        message: string;
        code: number;
    };
}

/**
 * Service class for handling Gemini API communication
 */
class GeminiService {
    private ws: WebSocket | null = null;
    private model: string;
    private apiKey: string;


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
          const config = {
            model: this.model,
            generation_config: {
               response_modalities: ['TEXT'],
            },
            system_instruction: instruction,
        };


      const message = JSON.stringify({
           "BidiGenerateContentSetup": config
       });


        this.ws.send(message);
    }

    /**
     * Processes incoming messages from Gemini API
     * @param event WebSocket message event
     * @returns Processed response or null if invalid
     */
     processGeminiResponse(event: MessageEvent): GeminiResponse | null {
        if (event.data instanceof Blob) {
            console.log("received blob data, not processing");
            return null;
        }
         try {
           const response = JSON.parse(event.data) as GeminiWebSocketMessage;
            if (response.BidiGenerateContentServerContent?.model_turn) {
                const text = response.BidiGenerateContentServerContent.model_turn.parts
                    .filter((part): part is { text: string } => typeof part.text === 'string')
                    .map((part) => part.text)
                    .join('');
                const isInterrupted = response.BidiGenerateContentServerContent.interrupted === true;
                return { text: text, isInterrupted: isInterrupted };
            }

            if (response.BidiGenerateContentResponse?.code) {
                console.error("Gemini API error", response.BidiGenerateContentResponse);
                throw new Error(`Gemini API error: ${response.BidiGenerateContentResponse.message}`)
            }
              return null;
         } catch (error) {
            console.error("Error parsing message", error);
            throw new Error('Error parsing message' + error)
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
    * Sends audio data to Gemini API
    * @param audioData Audio data as Uint8Array
    * @param role Speaker role (user or interviewer)
    * @throws Error if WebSocket is not connected
    */
    async sendAudio(audioData: Float32Array, role: string = "user"): Promise<void> {
        if (!this.ws) {
            throw new Error("Gemini service not connected");
        }

        const uint8Array = new Uint8Array(audioData.buffer);


         const message = JSON.stringify({
           "BidiGenerateContentRealtimeInput": {
               "media_chunks": [Array.from(uint8Array)],
             "client_content": {
                "turns": [
                    {
                       "parts": [
                         {
                           "role": role,
                             "mime_type": "audio/raw"
                            }
                       ]
                    }
                ]
             }
           }
       });

       this.ws.send(message);
     }
}

export default GeminiService;
