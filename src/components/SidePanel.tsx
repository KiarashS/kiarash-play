import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer, useProgress } from '../player/PlayerContext';
import type { Track } from '../types';
import { formatTime } from '../lib/library';
import { Cover } from './Cover';
import { CloseIcon, GripIcon } from './Icons';

interface Props {
  kind: 'queue' | 'lyrics';
  onClose: () => void;
}

export function SidePanel({ kind, onClose }: Props) {
  return (
    <aside className="panel glass glass--lit" aria-label={kind === 'queue' ? 'Play queue' : 'Lyrics'}>
      <header className="panel__head">
        <h2>{kind === 'queue' ? 'Queue' : 'Lyrics'}</h2>
        {kind === 'queue' && <ClearUpcoming />}
        <button type="button" className="btn btn--sm btn--icon" aria-label="Close panel" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </header>
      <div className={`panel__body${kind === 'lyrics' ? ' panel__body--plain' : ''}`}>
        {kind === 'queue' ? <QueueBody /> : <LyricsBody />}
      </div>
    </aside>
  );
}

function ClearUpcoming() {
  const { upcoming, clearUpcoming } = usePlayer();
  if (upcoming.length === 0) return null;
  return (
    <button type="button" className="btn btn--sm" onClick={clearUpcoming}>
      Clear
    </button>
  );
}

function QueueRow({
  track,
  index,
  active,
  draggable,
}: {
  track: Track;
  index: number;
  active?: boolean;
  draggable?: boolean;
}) {
  const player = usePlayer();
  return (
    <li
      className="queue-item"
      data-current={active}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(index));
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      {draggable && (
        <span className="queue-item__grip" aria-hidden="true">
          <GripIcon />
        </span>
      )}
      <div className="queue-item__art">
        <Cover art={track.art} seed={track.id} label={track.title} hue={track.hue} />
      </div>
      <button type="button" className="queue-item__text" onClick={() => player.jump(index)}>
        <div className="track__title" style={active ? { color: 'var(--accent)' } : undefined}>
          {track.title}
        </div>
        <div className="track__artist">{track.artist}</div>
      </button>
      <span className="track__duration">{formatTime(track.duration)}</span>
      {!active && (
        <button
          type="button"
          className="btn btn--sm btn--icon"
          aria-label={`Remove ${track.title} from the queue`}
          onClick={() => player.removeAt(index)}
        >
          <CloseIcon size={14} />
        </button>
      )}
    </li>
  );
}

function QueueBody() {
  const player = usePlayer();
  const [dropAt, setDropAt] = useState<number | null>(null);

  if (!player.current) {
    return <p className="panel__empty">The queue is empty. Play something and it will show up here.</p>;
  }

  return (
    <>
      <div className="panel__group">Now playing</div>
      <ul>
        <QueueRow track={player.current} index={player.index} active />
      </ul>

      <div className="panel__group">
        {player.origin ? `Next from ${player.origin.title}` : 'Up next'}
      </div>
      {player.upcoming.length === 0 ? (
        <p className="panel__empty">Nothing queued after this track.</p>
      ) : (
        <ul
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const from = Number(event.dataTransfer.getData('text/plain'));
            if (Number.isFinite(from) && dropAt !== null) player.moveInQueue(from, dropAt);
            setDropAt(null);
          }}
        >
          {player.upcoming.map(({ track, index }) => (
            <div
              key={`${track.id}-${index}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDropAt(index);
              }}
              data-drop={dropAt === index}
            >
              <QueueRow track={track} index={index} draggable />
            </div>
          ))}
        </ul>
      )}
    </>
  );
}

export function LyricsBody({ className }: { className?: string }) {
  const { current, seek } = usePlayer();
  const { time } = useProgress();
  const containerRef = useRef<HTMLDivElement>(null);
  const lines = current?.lyrics ?? [];

  const activeIndex = useMemo(() => {
    let found = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].time <= time + 0.15) found = i;
      else break;
    }
    return found;
  }, [lines, time]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeIndex < 0) return;
    const line = container.children[activeIndex] as HTMLElement | undefined;
    if (!line) return;
    const offset = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
  }, [activeIndex]);

  if (lines.length === 0) {
    return <p className="panel__empty">No synced lyrics for this track.</p>;
  }

  return (
    <div ref={containerRef} className={`lyrics${className ? ` ${className}` : ''}`}>
      {lines.map((line, index) => (
        <button
          key={`${line.time}-${index}`}
          type="button"
          className="lyrics__line"
          data-active={index === activeIndex}
          onClick={() => seek(line.time)}
        >
          {line.text}
        </button>
      ))}
    </div>
  );
}
