// src/hooks/useAudio.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioManager, AudioError } from '@/services/AudioManager';
import { AudioStatus, AudioMetrics, AudioData, AudioConfig } from '@/types/audio';

interface UseAudioOptions {
    onData?: (data: AudioData) => void;
    onError?: (error: AudioError) => void;
    onStatusChange?: (status: AudioStatus) => void;
}

export const useAudio = (options: UseAudioOptions = {}) => {
    const [status, setStatus] = useState<AudioStatus>('inactive');
    const [error, setError] = useState<AudioError | null>(null);
    const [metrics, setMetrics] = useState<AudioMetrics | null>(null);
    
    const audioManager = useRef(AudioManager.getInstance());
    const optionsRef = useRef(options);

    // Update options ref when they change
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const handleAudioData = useCallback((data: AudioData) => {
        setMetrics(data.metrics);
        optionsRef.current.onData?.(data);
    }, []);

    const handleError = useCallback((error: AudioError) => {
        setError(error);
        optionsRef.current.onError?.(error);
    }, []);

    const handleStatusChange = useCallback((newStatus: AudioStatus) => {
        setStatus(newStatus);
        setError(null);
        optionsRef.current.onStatusChange?.(newStatus);
    }, []);

    useEffect(() => {
        const manager = audioManager.current;

        // Set up event listeners
        manager.on('audioData', handleAudioData);
        manager.on('error', handleError);
        manager.on('statusChange', handleStatusChange);

        return () => {
            // Clean up event listeners
            manager.off('audioData', handleAudioData);
            manager.off('error', handleError);
            manager.off('statusChange', handleStatusChange);
        };
    }, [handleAudioData, handleError, handleStatusChange]);

       const startAudio = useCallback(async (sourceType: string, config?: Partial<AudioConfig>) => {
           try {
                 await audioManager.current.initialize(config)
                await audioManager.current.startAudio(sourceType);
           } catch (error) {
              if (error instanceof AudioError) {
                  handleError(error);
                } else {
                  handleError(new AudioError('UNKNOWN', 'Failed to start audio capture'));
                }
           }
        }, [handleError]);

    const stopAudio = useCallback(async () => {
        try {
            await audioManager.current.stopAudio();
        } catch (error) {
            console.error('Error stopping audio:', error);
        }
    }, []);
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            audioManager.current.cleanup().catch(console.error);
        };
    }, []);

    return {
        status,
        error,
        metrics,
        isActive: status === 'active',
        startAudio,
        stopAudio
    };
};
