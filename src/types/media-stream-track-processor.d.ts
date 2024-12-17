// src/types/media-stream-track-processor.d.ts

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
