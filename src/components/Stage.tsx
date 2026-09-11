import { useEffect, useState } from 'react';
import { usePlayer, useProgress } from '../player/PlayerContext';
import { useCollections } from '../state/collections';
import { formatTime } from '../lib/library';
import { Cover } from './Cover';
import { ArtistLinks } from './ArtistLinks';
import { Scrub } from './Scrub';
import { LyricsBody } from './SidePanel';
import {
  CollapseIcon,
  HeartIcon,
  LyricsIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from './Icons';

function Times() {
  const { time, duration } = useProgress();
  const { current } = usePlayer();
  return (
    <>
      <span className="dock__time">{formatTime(time)}</span>
      <Scrub waveform={current?.waveform} />
      <span className="dock__time dock__time--right">{formatTime(duration || current?.duration || 0)}</span>
    </>
  );
}

/** The full-screen view: artwork, controls, and lyrics when the track has them. */
export function Stage({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const { isLiked, toggleLike } = useCollections();
  const [showLyrics, setShowLyrics] = useState(false);
  const track = player.current;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!track) return null;
  const liked = isLiked(track.id);
  const hasLyrics = Boolean(track.lyrics?.length);

  return (
    <div className="stage" data-playing={player.isPlaying} role="dialog" aria-modal="true" aria-label="Now playing">
      <header className="stage__head">
        <button type="button" className="btn btn--icon" aria-label="Close full screen" onClick={onClose}>
          <CollapseIcon size={18} />
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          {hasLyrics && (
            <button
              type="button"
              className={`btn btn--icon${showLyrics ? ' is-active' : ''}`}
              aria-pressed={showLyrics}
              aria-label="Lyrics"
              onClick={() => setShowLyrics((value) => !value)}
            >
              <LyricsIcon size={18} />
            </button>
          )}
          <button
            type="button"
            className={`btn btn--icon${liked ? ' is-active' : ''}`}
            aria-pressed={liked}
            aria-label={liked ? 'Remove from Liked' : 'Add to Liked'}
            onClick={() => toggleLike(track.id)}
          >
            <HeartIcon size={18} filled={liked} />
          </button>
        </div>
      </header>

      <div className="stage__body">
        {showLyrics && hasLyrics ? (
          <div className="stage__lyrics">
            <LyricsBody />
          </div>
        ) : (
          <div className="stage__art">
            <Cover art={track.art} seed={track.id} label={track.title} hue={track.hue} style={{ fontSize: 64 }} />
          </div>
        )}

        <div className="stage__text">
          <div className="stage__title">{track.title}</div>
          <ArtistLinks track={track} className="stage__artist" />
          {player.origin && <div className="chip" style={{ marginTop: 12 }}>{player.origin.title}</div>}
        </div>

        <div className="stage__scrub">
          <Times />
        </div>

        <div className="stage__controls">
        <button
          type="button"
          className="btn btn--icon"
          aria-pressed={player.shuffle}
          aria-label="Shuffle"
          onClick={player.toggleShuffle}
        >
          <ShuffleIcon size={19} />
        </button>
        <button type="button" className="btn btn--icon" aria-label="Previous track" onClick={player.previous}>
          <PrevIcon size={24} />
        </button>
        <button
          type="button"
          className="btn--play"
          style={{ width: 66, height: 66 }}
          aria-label={player.isPlaying ? 'Pause' : 'Play'}
          onClick={player.toggle}
        >
          {player.isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
        </button>
        <button type="button" className="btn btn--icon" aria-label="Next track" onClick={player.next}>
          <NextIcon size={24} />
        </button>
        <button
          type="button"
          className="btn btn--icon"
          aria-pressed={player.repeat !== 'off'}
          aria-label="Repeat"
          onClick={player.cycleRepeat}
          >
            {player.repeat === 'one' ? <RepeatOneIcon size={19} /> : <RepeatIcon size={19} />}
          </button>
        </div>
      </div>
    </div>
  );
}
