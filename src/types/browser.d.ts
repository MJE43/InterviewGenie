// src/types/browser.d.ts

// Augment MediaTrackConstraints with Screen Capture API extensions
// Extend the MediaTrackConstraints interface for Screen Capture API
interface MediaTrackConstraints {
  systemAudio?: 'include' | 'exclude';
  selfBrowserSurface?: 'include' | 'exclude';
  displaySurface?: 'window' | 'browser' | 'monitor';
  suppressLocalAudioPlayback?: boolean;
  autoGainControl?: boolean;
}

// Keep the MediaStreamTrackProcessor definitions
interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack;
  maxBufferSize?: number;
}

interface MediaStreamTrackProcessor {
  readonly readable: ReadableStream;
  readonly track: MediaStreamTrack;
  readonly maxBufferSize?: number;
  readonly isClosed: boolean;
}

declare const MediaStreamTrackProcessor: {
  prototype: MediaStreamTrackProcessor;
  new (init: MediaStreamTrackProcessorInit): MediaStreamTrackProcessor;
};
