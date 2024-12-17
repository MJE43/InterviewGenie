// src/lib/events.ts

import { AudioStatus, AudioError, AudioData, AudioMetrics } from '@/types/audio';

// Define all possible event types and their corresponding payload types
export interface EventMap {
    statusChange: AudioStatus;
    error: AudioError;
    audioData: AudioData;
    metricsUpdate: AudioMetrics;
}

// Type-safe callback type for each event
export type EventCallback<K extends keyof EventMap> = (data: EventMap[K]) => void;

export class EventDispatcher {
    private listeners: Map<keyof EventMap, Set<EventCallback<keyof EventMap>>>;

    constructor() {
        this.listeners = new Map();
    }

    on<K extends keyof EventMap>(event: K, callback: EventCallback<K>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        // Type assertion needed here as TypeScript cannot infer the relationship
        // between K and the Set type across the Map get
        this.listeners.get(event)!.add(callback as EventCallback<keyof EventMap>);
    }

    off<K extends keyof EventMap>(event: K, callback: EventCallback<K>): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback as EventCallback<keyof EventMap>);
            if (callbacks.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    (callback as EventCallback<K>)(data);
                } catch (error) {
                    console.error(`Error in event handler for ${String(event)}:`, error);
                }
            });
        }
    }

    once<K extends keyof EventMap>(event: K, callback: EventCallback<K>): void {
        const onceWrapper: EventCallback<K> = ((data: EventMap[K]) => {
            this.off(event, onceWrapper);
            callback(data);
        });
        this.on(event, onceWrapper);
    }

    removeAllListeners(event?: keyof EventMap): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    listenerCount(event: keyof EventMap): number {
        return this.listeners.get(event)?.size ?? 0;
    }
};
