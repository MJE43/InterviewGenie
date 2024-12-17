// src/lib/events.ts

import { BaseEventMap, EventCallback, EventHandlerMap } from '@/types/events';

export class EventDispatcher<T extends BaseEventMap> {
    private readonly listeners: EventHandlerMap<T>;

    constructor() {
        this.listeners = new Map();
    }

    public on<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        // TypeScript requires this assertion due to Map.get() return type
        this.listeners.get(event)!.add(callback as EventCallback<T[keyof T]>);
    }

    public off<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback as EventCallback<T[keyof T]>);
            if (callbacks.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    protected emit<K extends keyof T>(event: K, data: T[K]): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    (callback as EventCallback<T[K]>)(data);
                } catch (error) {
                    console.error(
                        `Error in event handler for ${String(event)}:`,
                        error instanceof Error ? error.message : 'Unknown error'
                    );
                }
            });
        }
    }

    public once<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void {
        const onceWrapper = ((data: T[K]) => {
            this.off(event, onceWrapper);
            callback(data);
        }) as EventCallback<T[K]>;
        
        this.on(event, onceWrapper);
    }

    public removeAllListeners(event?: keyof T): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    public listenerCount(event: keyof T): number {
        return this.listeners.get(event)?.size ?? 0;
    }
}
