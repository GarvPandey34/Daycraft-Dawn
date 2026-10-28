import React, { useEffect, useRef, useState } from 'react';
import { soundService } from '../../services/soundService';
import { useMotionPreference } from '../../theme/motion';
import { Activity, Eye, EyeOff, Waves, BarChart2 } from 'lucide-react';

interface AudioVisualizerProps {
  className?: string;
  height?: number;
  showToggle?: boolean;
}

type VisualizerStyle = 'bars' | 'wave';

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  className = '',
  height = 24,
  showToggle = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const freqBufferRef = useRef<Uint8Array>(new Uint8Array(32));
  const phaseRef = useRef<number>(0);

  const { isReduced, isPageVisible } = useMotionPreference();
  const [hasAudioOutput, setHasAudioOutput] = useState(() => {
    return soundService.getAudioAnalysisData().isPlaying;
  });

  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('daycraft_audio_visualizer_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [vizStyle, setVizStyle] = useState<VisualizerStyle>(() => {
    try {
      const saved = localStorage.getItem('daycraft_audio_visualizer_style');
      return saved === 'wave' ? 'wave' : 'bars';
    } catch {
      return 'bars';
    }
  });

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem('daycraft_audio_visualizer_enabled', String(next));
    } catch {
      // ignore
    }
  };

  const toggleStyle = () => {
    const next: VisualizerStyle = vizStyle === 'bars' ? 'wave' : 'bars';
    setVizStyle(next);
    try {
      localStorage.setItem('daycraft_audio_visualizer_style', next);
    } catch {
      // ignore
    }
  };

  // Subscribe to soundService state changes so we wake up the canvas loop immediately when tracks start/stop
  useEffect(() => {
    const checkState = () => {
      const active =
        soundService.getActiveTrackCount() > 0 &&
        !soundService.isMuted() &&
        soundService.getMasterVolume() > 0.001;
      setHasAudioOutput(active);
    };
    checkState();
    return soundService.subscribe(checkState);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    const barCount = 18;
    const barWidth = 3;
    const gap = 2.5;
    const width = canvas.width;
    const h = canvas.height;

    const drawStaticFrame = (playing: boolean) => {
      ctx.clearRect(0, 0, width, h);
      ctx.fillStyle = playing ? 'rgba(110, 231, 183, 0.55)' : 'rgba(167, 243, 208, 0.16)';
      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap) + 4;
        const barH = playing ? 5 + (i % 3) * 2 : 2;
        ctx.beginPath();
        ctx.roundRect(x, (h - barH) / 2, barWidth, barH, 1.5);
        ctx.fill();
      }
    };

    // If disabled, reduced motion, page hidden, or no audio is playing, draw a single resting frame and stop RAF
    if (!enabled || isReduced || !isPageVisible || !hasAudioOutput) {
      drawStaticFrame(hasAudioOutput && enabled);
      return;
    }

    const render = () => {
      if (!isRunning) return;

      const analysis = soundService.getAudioAnalysisData(freqBufferRef.current);
      const isPlaying = analysis.isPlaying;

      ctx.clearRect(0, 0, width, h);

      if (!isPlaying) {
        drawStaticFrame(false);
        return;
      }

      if (vizStyle === 'wave') {
        // Subtle flowing waveform driven by real RMS + frequency bins
        phaseRef.current += 0.06 + analysis.rms * 0.08;
        ctx.beginPath();
        ctx.lineWidth = 1.75;
        ctx.strokeStyle = 'rgba(110, 231, 183, 0.82)';

        const midY = h / 2;
        for (let x = 2; x < width - 2; x += 2) {
          const normX = x / width;
          const binIdx = Math.min(23, Math.floor(normX * 20));
          const freqAmp = (freqBufferRef.current[binIdx] || 0) / 255;
          const envelope = Math.sin(normX * Math.PI); // taper edges
          const waveY =
            Math.sin(normX * 7 + phaseRef.current) *
            Math.max(1.5, (freqAmp * 0.75 + analysis.rms * 0.5) * (h * 0.42)) *
            envelope;

          if (x === 2) {
            ctx.moveTo(x, midY + waveY);
          } else {
            ctx.lineTo(x, midY + waveY);
          }
        }
        ctx.stroke();
      } else {
        // Gently moving frequency bars matched to actual signal
        for (let i = 0; i < barCount; i++) {
          const binIndex = Math.floor((i / barCount) * 22);
          const rawAmp = (freqBufferRef.current[binIndex] || 0) / 255;
          const scaledAmp = Math.max(0.14, Math.pow(rawAmp, 1.15));
          const barH = Math.max(3, Math.min(h - 4, scaledAmp * (h - 4)));
          const x = i * (barWidth + gap) + 4;
          const y = (h - barH) / 2;

          const alpha = 0.48 + Math.min(0.48, scaledAmp * 0.55);
          ctx.fillStyle =
            i % 2 === 0
              ? `rgba(110, 231, 183, ${alpha})`
              : `rgba(52, 211, 153, ${alpha * 0.9})`;

          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, 1.5);
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [enabled, isReduced, isPageVisible, hasAudioOutput, vizStyle, height]);

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-950/65 border border-emerald-800/40 select-none ${className}`}
      title={
        hasAudioOutput
          ? 'Real-time acoustic output analysis'
          : 'Audio visualizer resting (no active sound output)'
      }
    >
      <div className="flex items-center gap-1.5">
        <Activity
          className="w-3.5 h-3.5"
          style={{ color: hasAudioOutput ? '#6EE7B7' : '#6B7280' }}
        />
        <span
          className="text-[11px] font-mono tracking-tight font-medium whitespace-nowrap"
          style={{ color: hasAudioOutput ? '#D1FAE5' : '#9CA3AF' }}
        >
          {hasAudioOutput ? 'Live Signal' : 'Idle'}
        </span>
      </div>

      {enabled && (
        <canvas
          ref={canvasRef}
          width={104}
          height={height}
          className="block"
          aria-hidden="true"
        />
      )}

      {showToggle && (
        <div className="flex items-center gap-1 pl-1 border-l border-emerald-800/40">
          {enabled && (
            <button
              type="button"
              onClick={toggleStyle}
              aria-label={`Switch visualizer style to ${vizStyle === 'bars' ? 'waveform' : 'bars'}`}
              title={`Visualizer style: ${vizStyle === 'bars' ? 'Frequency Bars' : 'Flowing Waveform'}`}
              className="p-1 rounded-md text-emerald-300/75 hover:text-emerald-200 hover:bg-emerald-900/50 transition-colors cursor-pointer"
            >
              {vizStyle === 'bars' ? (
                <Waves className="w-3 h-3" />
              ) : (
                <BarChart2 className="w-3 h-3" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={toggleEnabled}
            aria-label={enabled ? 'Hide audio visualization' : 'Show audio visualization'}
            title={enabled ? 'Hide audio visualization' : 'Show audio visualization'}
            className="p-1 rounded-md text-emerald-300/75 hover:text-emerald-200 hover:bg-emerald-900/50 transition-colors cursor-pointer"
          >
            {enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
};
