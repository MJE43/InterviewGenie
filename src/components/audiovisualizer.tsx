// src/components/audiovisualizer.tsx
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { AudioData, AudioMetrics } from '@/types/audio';
import { useAudio } from '@/hooks/useAudio';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AudioVisualizerProps {
    className?: string;
    width?: number;
    height?: number;
    bufferSize?: number;
    showMetrics?: boolean;
}

interface VisualizationConfig {
    readonly backgroundColor: string;
    readonly activeColor: string;
    readonly warningColor: string;
    readonly gridColor: string;
    readonly fontSize: number;
    readonly lineWidth: number;
    readonly maxBufferSize: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
    className = '',
    width = 200,
    height = 60,
    bufferSize = 50,
    showMetrics = true
}) => {
    // Canvas and animation refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const metricsBufferRef = useRef<AudioMetrics[]>([]);
    const animationFrameRef = useRef<number>();
    
    // Memoized configuration to prevent recreation
    const config = useMemo<VisualizationConfig>(() => ({
        backgroundColor: 'rgb(23, 23, 23)',
        activeColor: 'rgb(34, 197, 94)',
        warningColor: 'rgb(239, 68, 68)',
        gridColor: 'rgba(255, 255, 255, 0.1)',
        fontSize: 10,
        lineWidth: 2,
        maxBufferSize: bufferSize
    }), [bufferSize]);

    // Audio system integration
    const { metrics, status, error } = useAudio({
        onData: useCallback((data: AudioData) => {
            metricsBufferRef.current.push(data.metrics);
            if (metricsBufferRef.current.length > config.maxBufferSize) {
                metricsBufferRef.current.shift();
            }
        }, [config.maxBufferSize])
    });

    // Canvas drawing utilities
    const setupCanvas = useCallback((canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        return ctx;
    }, [width, height]);

    const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = config.gridColor;
        ctx.lineWidth = 0.5;
        
        // Vertical grid
        for (let x = 0; x < width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal grid
        for (let y = 0; y < height; y += 10) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }, [width, height, config]);

    const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, metrics: AudioMetrics[]) => {
        if (metrics.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        metrics.forEach((metric, i) => {
            const x = (i / config.maxBufferSize) * width;
            const y = height / 2 + (metric.average * height * 0.5);
            ctx.lineTo(x, y);
        });

        const latestMetric = metrics[metrics.length - 1];
        ctx.strokeStyle = latestMetric?.clipping ? 
            config.warningColor : 
            config.activeColor;
        ctx.lineWidth = config.lineWidth;
        ctx.stroke();
    }, [width, height, config]);

    const drawVolumeIndicator = useCallback((ctx: CanvasRenderingContext2D, currentMetrics: AudioMetrics) => {
        const rmsHeight = Math.min(currentMetrics.rms * height, height);
        const gradient = ctx.createLinearGradient(0, height, 0, height - rmsHeight);
        
        gradient.addColorStop(0, config.activeColor);
        gradient.addColorStop(1, currentMetrics.clipping ? config.warningColor : config.activeColor);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(width - 20, height - rmsHeight, 10, rmsHeight);
    }, [width, height, config]);

    // Main animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = setupCanvas(canvas);
        if (!ctx) return;

        const animate = () => {
            drawBackground(ctx);

            const currentMetrics = metricsBufferRef.current;
            if (currentMetrics.length > 0) {
                drawWaveform(ctx, currentMetrics);
                drawVolumeIndicator(ctx, currentMetrics[currentMetrics.length - 1]);
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [setupCanvas, drawBackground, drawWaveform, drawVolumeIndicator]);

    return (
        <div className={cn("relative", className)}>
            <canvas 
                ref={canvasRef}
                className="rounded-md shadow-sm"
                aria-label="Audio visualization"
            />
            {showMetrics && metrics && (
                <div className="absolute top-2 left-2 flex gap-2">
                    <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                        {metrics.clipping ? 'CLIPPING' : 'Level: ' + Math.round(metrics.rms * 100) + '%'}
                    </Badge>
                    <Badge variant="outline">
                        Peak: {Math.round(metrics.peak * 100)}%
                    </Badge>
                </div>
            )}
            {error && (
                <div className="absolute bottom-2 left-2">
                    <Badge variant="destructive">
                        {error.message}
                    </Badge>
                </div>
            )}
        </div>
    );
};

export default React.memo(AudioVisualizer);
