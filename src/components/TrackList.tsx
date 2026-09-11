import { useState } from 'react';
import type { QueueOrigin, Track } from '../types';
import { usePlayer } from '../player/PlayerContext';
import { useCollections } from '../state/collections';
import { useUi } from '../state/ui';
import { formatTime } from '../lib/library';
import { Cover } from './Cover';
import { ArtistLinks } from './ArtistLinks';
import { Popover } from './Popover';
import { HeartIcon, MoreIcon, PauseIcon, PlayIcon, QueueIcon } from './Icons';

interface Props {
  tracks: Track[];
  origin: QueueOrigin;
  showAlbum?: boolean;
}

export function TrackList({ tracks, origin, showAlbum = true }: Props) {
  const player = usePlayer();
  const { isLiked, toggleLike } = useCollections();
  const { notify } = useUi();
  const [menuFor, setMenuFor] = useState<{ track: Track; anchor: HTMLElement } | null>(null);

  const ids = tracks.map((track) => track.id);

  const start = (index: number) => {
    const track = tracks[index];
    if (player.current?.id === track.id && player.origin?.id === origin.id) {
      player.toggle();
      return;
    }
    player.playContext(ids, index, origin);
  };

  return (
    <>
      <div className="tracks glass glass--flat" role="list">
        {tracks.map((track, index) => {
          const isCurrent = player.current?.id === track.id;
          const liked = isLiked(track.id);
          return (
            <div
              key={`${track.id}-${index}`}
              className="track"
              role="listitem"
              data-current={isCurrent}
              onDoubleClick={() => start(index)}
            >
              <div className="track__index">
                {isCurrent && player.isPlaying ? (
                  <span className="equaliser" data-paused={!player.isPlaying} aria-label="Now playing">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <span className="track__index-number">{index + 1}</span>
                )}
                <button
                  type="button"
                  className="track__index-action"
                  onClick={() => start(index)}
                  aria-label={isCurrent && player.isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                >
                  {isCurrent && player.isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                </button>
              </div>

              <div className="track__art">
                <Cover art={track.art} seed={track.id} label={track.title} hue={track.hue} />
              </div>

              <div className="track__main">
                <div className="track__title">{track.title}</div>
                <ArtistLinks track={track} className="track__artist" />
              </div>

              {showAlbum && <div className="track__album">{track.album ?? ''}</div>}

              <button
                type="button"
                className={`btn btn--sm btn--icon track__like${liked ? ' is-active' : ''}`}
                aria-pressed={liked}
                aria-label={liked ? `Remove ${track.title} from Liked` : `Add ${track.title} to Liked`}
                onClick={() => {
                  toggleLike(track.id);
                  notify(liked ? 'Removed from Liked' : 'Added to Liked');
                }}
              >
                <HeartIcon size={15} filled={liked} />
              </button>

              <div className="track__duration">{formatTime(track.duration)}</div>

              <button
                type="button"
                className="btn btn--sm btn--icon track__more"
                aria-label={`More actions for ${track.title}`}
                aria-haspopup="menu"
                onClick={(event) => setMenuFor({ track, anchor: event.currentTarget })}
              >
                <MoreIcon size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {menuFor && (
        <Popover anchor={menuFor.anchor} onClose={() => setMenuFor(null)}>
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            onClick={() => {
              player.enqueue([menuFor.track.id], true);
              notify('Playing next');
              setMenuFor(null);
            }}
          >
            <QueueIcon size={15} />
            Play next
          </button>
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            onClick={() => {
              player.enqueue([menuFor.track.id]);
              notify('Added to queue');
              setMenuFor(null);
            }}
          >
            <QueueIcon size={15} />
            Add to queue
          </button>
          <div className="menu__sep" />
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            onClick={() => {
              void navigator.clipboard?.writeText(menuFor.track.source);
              notify('Source URL copied');
              setMenuFor(null);
            }}
          >
            Copy source URL
          </button>
        </Popover>
      )}
    </>
  );
}
