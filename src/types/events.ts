// src/types/events.ts

/**
 * Base type for all event maps in the system.
 * Enforces string keys and unknown values to ensure type safety while
 * maintaining flexibility for different event types.
 */
export type BaseEventMap = {
  [K: string]: unknown;
};

/**
* Type-safe callback type for event handlers.
* @template T The type of data the callback will receive
*/
export type EventCallback<T> = (data: T) => void;

/**
* Type definition for event handler storage.
* Uses a Map for O(1) lookups and Set for unique callbacks.
* @template T Extends BaseEventMap to ensure type safety across event systems
*/
export type EventHandlerMap<T extends BaseEventMap> = Map<keyof T, Set<EventCallback<T[keyof T]>>>;

/**
* Type-safe event unsubscribe function.
* Returns void to indicate completion of unsubscription.
*/
export type Unsubscribe = () => void;
