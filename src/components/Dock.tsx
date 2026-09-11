import { useState } from 'react';
import { usePlayer, useProgress } from '../player/PlayerContext';
import { useCollections } from '../state/collections';
import { useUi } from '../state/ui';
import { formatTime } from '../lib/library';
import { Cover } from './Cover';
import { Scrub } from './Scrub';
import { Visualiser } from './Visualiser';
import { Popover } from './Popover';
import {
  ExpandIcon,
  HeartIcon,
  LyricsIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  TimerIcon,
  VolumeIcon,
} from './Icons';

const SLEEP_PRESETS = [15, 30, 45, 60];

interface Props {
  panel: 'queue' | 'lyrics' | null;
  onPanelChange: (panel: 'queue' | 'lyrics' | null) => void;
  onExpand: () => void;
}

function ThinProgress() {
  const { time, duration } = useProgress();
  const ratio = duration > 0 ? Math.min(1, time / duration) : 0;
  return <div className="dock__thin mobile-only" style={{ width: `${ratio * 100}%` }} />;
}

function Elapsed() {
  const { time, duration } = useProgress();
  const { current } = usePlayer();
  const total = duration || current?.duration || 0;
  return (
    <>
      <span className="dock__time">{formatTime(time)}</span>
      <Scrub waveform={current?.waveform} />
      <span className="dock__time dock__time--right">{formatTime(total)}</span>
    </>
  );
}

export function Dock({ panel, onPanelChange, onExpand }: Props) {
  const player = usePlayer();
  const { isLiked, toggleLike } = useCollections();
  const { notify } = useUi();
  const [sleepAnchor, setSleepAnchor] = useState<HTMLElement | null>(null);

  const track = player.current;
  const liked = track ? isLiked(track.id) : false;
  const hasLyrics = Boolean(track?.lyrics?.length);

  const repeatLabel =
    player.repeat === 'one' ? 'Repeat one' : player.repeat === 'all' ? 'Repeat all' : 'Repeat off';

  return (
    <section className="dock glass glass--lit" aria-label="Player controls">
      <Visualiser />
      <ThinProgress />

      <div className="dock__now">
        {track ? (
          <>
            <button type="button" className="dock__art" onClick={onExpand} aria-label="Open full screen player">
              <Cover art={track.art} seed={track.id} label={track.title} hue={track.hue} />
            </button>
            <div className="dock__text">
              <div className="dock__title">{track.title}</div>
              <div className="dock__artist">{track.artist}</div>
            </div>
            <button
              type="button"
              className={`btn btn--sm btn--icon desktop-only${liked ? ' is-active' : ''}`}
              aria-pressed={liked}
              aria-label={liked ? 'Remove from Liked' : 'Add to Liked'}
              onClick={() => {
                toggleLike(track.id);
                notify(liked ? 'Removed from Liked' : 'Added to Liked');
              }}
            >
              <HeartIcon size={16} filled={liked} />
            </button>
          </>
        ) : (
          <div className="dock__text">
            <div className="dock__title">Nothing playing</div>
            <div className="dock__artist">Pick a playlist to start</div>
          </div>
        )}
      </div>

      <div className="dock__center">
        <div className="dock__buttons">
          <button
            type="button"
            className="btn btn--icon desktop-only"
            aria-pressed={player.shuffle}
            aria-label="Shuffle"
            onClick={player.toggleShuffle}
          >
            <ShuffleIcon size={16} />
          </button>
          <button
            type="button"
            className="btn btn--icon desktop-only"
            aria-label="Previous track"
            onClick={player.previous}
            disabled={!track}
          >
            <PrevIcon size={18} />
          </button>
          <button
            type="button"
            className="btn--play"
            aria-label={player.isPlaying ? 'Pause' : 'Play'}
            onClick={player.toggle}
            disabled={!track}
          >
            {player.isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
          </button>
          <button
            type="button"
            className="btn btn--icon"
            aria-label="Next track"
            onClick={player.next}
            disabled={!track}
          >
            <NextIcon size={18} />
          </button>
          <button
            type="button"
            className="btn btn--icon desktop-only"
            aria-pressed={player.repeat !== 'off'}
            aria-label={repeatLabel}
            title={repeatLabel}
            onClick={player.cycleRepeat}
          >
            {player.repeat === 'one' ? <RepeatOneIcon size={16} /> : <RepeatIcon size={16} />}
          </button>
        </div>

        <div className="dock__scrub">
          <Elapsed />
        </div>
      </div>

      <div className="dock__right">
        <button
          type="button"
          className={`btn btn--icon desktop-only${panel === 'lyrics' ? ' is-active' : ''}`}
          aria-pressed={panel === 'lyrics'}
          aria-label="Lyrics"
          title={hasLyrics ? 'Lyrics' : 'No lyrics for this track'}
          disabled={!hasLyrics}
          onClick={() => onPanelChange(panel === 'lyrics' ? null : 'lyrics')}
        >
          <LyricsIcon size={16} />
        </button>
        <button
          type="button"
          className={`btn btn--icon${panel === 'queue' ? ' is-active' : ''}`}
          aria-pressed={panel === 'queue'}
          aria-label="Queue"
          onClick={() => onPanelChange(panel === 'queue' ? null : 'queue')}
        >
          <QueueIcon size={16} />
        </button>
        <button
          type="button"
          className={`btn btn--icon desktop-only${player.sleepTimer ? ' is-active' : ''}`}
          aria-label="Sleep timer"
          aria-haspopup="menu"
          onClick={(event) => setSleepAnchor(event.currentTarget)}
        >
          <TimerIcon size={16} />
        </button>

        <div className="volume desktop-only">
          <button
            type="button"
            className="btn btn--sm btn--icon"
            aria-label={player.muted ? 'Unmute' : 'Mute'}
            onClick={player.toggleMute}
          >
            <VolumeIcon size={16} level={player.muted ? 0 : player.volume} />
          </button>
          <input
            className="volume__slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={player.muted ? 0 : player.volume}
            aria-label="Volume"
            style={{ ['--fill' as string]: `${(player.muted ? 0 : player.volume) * 100}%` }}
            onChange={(event) => player.setVolume(Number(event.target.value))}
          />
        </div>

        <button type="button" className="btn btn--icon" aria-label="Full screen player" onClick={onExpand}>
          <ExpandIcon size={16} />
        </button>
      </div>

      {sleepAnchor && (
        <Popover anchor={sleepAnchor} onClose={() => setSleepAnchor(null)}>
          {SLEEP_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="menu__item"
              role="menuitemradio"
              aria-checked={player.sleepTimer?.label === `${minutes} min`}
              onClick={() => {
                player.setSleepTimer({ until: Date.now() + minutes * 60_000, label: `${minutes} min` });
                notify(`Sleep timer set for ${minutes} minutes`);
                setSleepAnchor(null);
              }}
            >
              <TimerIcon size={15} />
              {minutes} minutes
            </button>
          ))}
          <button
            type="button"
            className="menu__item"
            role="menuitemradio"
            aria-checked={player.sleepTimer?.until === 'track'}
            onClick={() => {
              player.setSleepTimer({ until: 'track', label: 'End of track' });
              notify('Stopping at the end of this track');
              setSleepAnchor(null);
            }}
          >
            <TimerIcon size={15} />
            End of this track
          </button>
          {player.sleepTimer && (
            <>
              <div className="menu__sep" />
              <button
                type="button"
                className="menu__item"
                role="menuitem"
                onClick={() => {
                  player.setSleepTimer(null);
                  notify('Sleep timer cleared');
                  setSleepAnchor(null);
                }}
              >
                Cancel timer ({player.sleepTimer.label})
              </button>
            </>
          )}
        </Popover>
      )}
    </section>
  );
}
