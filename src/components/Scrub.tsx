import { useCallback, useRef, useState } from 'react';
import { usePlayer, useProgress } from '../player/PlayerContext';
import { formatTime } from '../lib/library';

interface Props {
  /** Peak values sampled at build time. Without them this renders a plain bar. */
  waveform?: number[] | null;
  compact?: boolean;
}

export function Scrub({ waveform, compact }: Props) {
  const { seek, current } = usePlayer();
  const { time, duration, buffered } = useProgress();
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const total = duration || current?.duration || 0;
  const ratio = dragRatio ?? (total > 0 ? Math.min(1, time / total) : 0);
  const bufferedRatio = total > 0 ? Math.min(1, buffered / total) : 0;

  const ratioAt = useCallback((clientX: number) => {
    const box = elementRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (total <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragRatio(ratioAt(event.clientX));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRatio === null) return;
    setDragRatio(ratioAt(event.clientX));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRatio === null) return;
    const next = ratioAt(event.clientX);
    setDragRatio(null);
    seek(next * total);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 30 : 5;
    if (event.key === 'ArrowRight') seek(time + step);
    else if (event.key === 'ArrowLeft') seek(time - step);
    else if (event.key === 'Home') seek(0);
    else if (event.key === 'End') seek(total);
    else return;
    event.preventDefault();
  };

  const percent = `${ratio * 100}%`;

  return (
    <div
      ref={elementRef}
      className="scrub"
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(ratio * total)}
      aria-valuetext={`${formatTime(ratio * total)} of ${formatTime(total)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      style={compact ? { height: 18 } : undefined}
    >
      {waveform && waveform.length > 0 ? (
        <div className="waveform">
          {waveform.map((peak, index) => (
            <div
              key={index}
              className="waveform__bar"
              data-played={index / waveform.length <= ratio}
              style={{ height: `${Math.max(8, peak * 100)}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="scrub__track">
          <div className="scrub__buffered" style={{ width: `${bufferedRatio * 100}%` }} />
          <div className="scrub__fill" style={{ width: percent }} />
        </div>
      )}
      <div className="scrub__head" style={{ left: percent }} />
    </div>
  );
}
