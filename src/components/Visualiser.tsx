import { useEffect, useRef } from 'react';
import { usePlayer } from '../player/PlayerContext';

/**
 * Live spectrum drawn behind the dock. It reads the analyser node the player
 * builds on first play, so before any user gesture there is simply nothing to draw.
 */
export function Visualiser() {
  const { analyser, isPlaying } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const smoothed = new Float32Array(analyser.frequencyBinCount);
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(box.width * dpr));
      canvas.height = Math.max(1, Math.floor(box.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const box = canvas.getBoundingClientRect();
      const width = box.width;
      const height = box.height;
      ctx.clearRect(0, 0, width, height);

      analyser.getByteFrequencyData(bins);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-h').trim() || '258';

      // The top bins are mostly silence in music; showing ~70% keeps the bars busy.
      const used = Math.floor(bins.length * 0.7);
      const count = Math.min(64, used);
      const step = used / count;
      const barWidth = width / count;

      for (let i = 0; i < count; i += 1) {
        const value = bins[Math.floor(i * step)] / 255;
        smoothed[i] = smoothed[i] * 0.72 + value * 0.28;
        const barHeight = Math.max(2, smoothed[i] ** 1.5 * height * 0.95);
        const x = i * barWidth;
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, `hsl(${accent} 85% 62% / 0.75)`);
        gradient.addColorStop(1, `hsl(${Number(accent) + 45} 85% 70% / 0.1)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + barWidth * 0.18, height - barHeight, barWidth * 0.64, barHeight, 2);
        ctx.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);

    if (isPlaying && !reduced) {
      frame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [analyser, isPlaying]);

  return <canvas ref={canvasRef} className="dock__visualiser" aria-hidden="true" />;
}
