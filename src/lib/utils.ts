import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AudioStreamType, AudioSourceType, ExtendedMediaStreamConstraints } from '@/types/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const captureSystemAudio = async (sourceType: AudioSourceType): Promise<AudioStreamType> => {
  try {
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
      suppressLocalAudioPlayback: true
    };
    let captureConfig: ExtendedMediaStreamConstraints = {
      audio: audioConstraints,
      systemAudio: "include",
      selfBrowserSurface: "exclude",
      displaySurface: "window"
    };
    if (sourceType === "multiple") {
      captureConfig = {
        audio: audioConstraints,
        systemAudio: "include",
        selfBrowserSurface: "exclude",
        displaySurface: "window"
      }
    }

    const stream = await navigator.mediaDevices.getDisplayMedia(captureConfig)
    return stream;
  } catch (error) {
    console.error('Error capturing system audio:', error);
    throw new Error('Failed to capture system audio: ' + error);
  }
};

export const captureMicrophoneAudio = async (): Promise<AudioStreamType> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      }
    });
    return stream;
  } catch (error) {
    console.error('Error capturing microphone audio:', error);
    throw new Error('Failed to capture microphone audio: ' + error);
  }
};

export const combineAudioStreams = async (stream1: MediaStream, stream2: MediaStream): Promise<MediaStream> => {
  try {
    const audioContext = new AudioContext();
    const source1 = audioContext.createMediaStreamSource(stream1);
    const source2 = audioContext.createMediaStreamSource(stream2);
    const destination = audioContext.createMediaStreamDestination();

    source1.connect(destination);
    source2.connect(destination);

    return destination.stream;
  } catch (error) {
    console.error('Error combining audio streams:', error)
    throw new Error('Failed to combine audio streams' + error);
  }
};

export const handleSystemError = (error: Error | unknown) => {
  console.error("System Error:", error);
};
