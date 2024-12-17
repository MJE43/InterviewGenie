import { 
  GeminiResponse,
  AudioStreamType
} from '@/types/types';

interface GeminiConfig {
  model: string;
    apiKey: string;
}

export interface GeminiWebSocketMessage {
  BidiGenerateContentServerContent?: {
    model_turn: {
      parts: Array<{ text: string }>;
    };
    interrupted?: boolean;
  };
}

export interface WebSocketErrorWithMessage extends Event {
  error: Error;
  message: string;
}

class GeminiService {
  private ws: WebSocket | null = null;
    private config: GeminiConfig;
    constructor(config: GeminiConfig) {
        this.config = config;
    }
  async connect(
    callback: (message: MessageEvent) => void,
    errorCallback: (error: WebSocketErrorWithMessage) => void
  ): Promise<void> {
        if (this.ws) {
            this.ws.close();
        }
      try {
           this.ws = new WebSocket('wss://generativelanguage.googleapis.com/v1alpha/live');

        this.ws.onopen = () => {
                console.log('Connected to Gemini API');
            };
           this.ws.onmessage = (event) => {
               callback(event);
            };
        this.ws.onerror = (error: Event) => {
           errorCallback(error as WebSocketErrorWithMessage);
         };
         this.ws.onclose = () => {
              console.log('Disconnected from Gemini API');
            };
      } catch (error) {
            console.error('Failed to connect to Gemini API:', error);
         throw new Error('Failed to connect to Gemini API');
     }
 }
    async startSession(systemInstruction: string): Promise<void> {
        if (!this.ws) {
            throw new Error('WebSocket not connected');
        }
        const config = {
           model: this.config.model,
           generation_config: {
               response_modalities: ['TEXT'],
                },
            system_instruction: systemInstruction,
        };

       const message = JSON.stringify({
            "BidiGenerateContentSetup": config
        });

        this.ws.send(message);
        console.log("sent initial config:", config);

 }
     async sendMessage(audioStream: AudioStreamType,  role: string = "user"): Promise<void> {
          if (!this.ws) {
             throw new Error('WebSocket not connected');
            }
         if (!audioStream) {
             console.warn("no audio stream");
             return
         }
         const audioTracks = audioStream.getAudioTracks();
         if (audioTracks.length === 0) {
              console.warn("no audio tracks");
             return
          }
         const processor = new MediaStreamTrackProcessor({ track: audioTracks[0] });
         const reader = processor.readable.getReader();
           try {
             while(true) {
                const { value: chunk, done } = await reader.read();
                    if (done) {
                         break;
                     }
                 const message = JSON.stringify({
                   "BidiGenerateContentRealtimeInput": {
                        "audio_chunks": [chunk],
                         "client_content": {
                            "turns": [
                              {
                                  "parts": [
                                       {
                                         "role": role,
                                          "mime_type":"audio/raw",
                                     }
                                   ]
                                 }
                            ]
                         }
                      }
                   });
                  this.ws.send(message);
                 }
        } catch (error) {
            console.error("failed to read or send message", error);
              throw new Error('failed to read or send message' + error);
        } finally {
            reader.releaseLock();
        }
 }

     processGeminiResponse (event: MessageEvent): GeminiResponse | null {
        if (event.data instanceof Blob) {
            console.log("received blob data, not processing");
            return null;
        }
         try {
           const response = JSON.parse(event.data) as GeminiWebSocketMessage;
            if (response.BidiGenerateContentServerContent?.model_turn) {
                const text = response.BidiGenerateContentServerContent.model_turn.parts.map(
                    (part: { text: string }) => part.text
                  ).join('');
                 const isInterrupted = response.BidiGenerateContentServerContent.interrupted === true;
                return {text: text, isInterrupted: isInterrupted};
            }

              return null;
         } catch (error) {
            console.error("Error parsing message", error);
            throw new Error('Error parsing message' + error)
         }
    }
    close() {
        if (this.ws) {
            this.ws.close();
             this.ws = null;
        }
    }
}

export default GeminiService;
