import { useMemo } from 'react';
import type { Artist, Library, QueueOrigin, Track } from '../types';
import { usePlayer } from '../player/PlayerContext';
import { formatLength, plural } from '../lib/library';
import { href, type Route } from '../lib/router';
import { Cover } from './Cover';
import { TrackList } from './TrackList';
import { PauseIcon, PlayIcon, ShuffleIcon } from './Icons';

function tracksOf(library: Library, ids: string[]): Track[] {
  const index = new Map(library.tracks.map((track) => [track.id, track]));
  return ids.map((id) => index.get(id)).filter((track): track is Track => Boolean(track));
}

function PlayArtist({ artist, ids, big }: { artist: Artist; ids: string[]; big?: boolean }) {
  const player = usePlayer();
  const origin: QueueOrigin = { kind: 'artist', id: artist.id, title: artist.name };
  const active = player.origin?.kind === 'artist' && player.origin.id === artist.id;
  const playing = active && player.isPlaying;

  return (
    <button
      type="button"
      className="btn--play"
      style={big ? { width: 56, height: 56 } : undefined}
      aria-label={playing ? `Pause ${artist.name}` : `Play ${artist.name}`}
      onClick={(event) => {
        event.stopPropagation();
        if (active) player.toggle();
        else player.playContext(ids, 0, origin);
      }}
    >
      {playing ? <PauseIcon size={big ? 22 : 18} /> : <PlayIcon size={big ? 22 : 18} />}
    </button>
  );
}

export function ArtistsView({
  library,
  onNavigate,
}: {
  library: Library;
  onNavigate: (route: Route) => void;
}) {
  return (
    <>
      <div className="section-head">
        <h2>Artists</h2>
        <p>Everyone credited on a track in this build</p>
      </div>
      <div className="card-grid">
        {library.artists.map((artist) => (
          <div key={artist.id} className="card glass glass--lit">
            <div className="card__art card__art--round">
              <Cover
                art={artist.art}
                seed={artist.id}
                hue={artist.hue}
                label={artist.name}
                style={{ fontSize: 40 }}
              />
              <span className="card__play">
                <PlayArtist artist={artist} ids={artist.trackIds} />
              </span>
            </div>
            <a
              href={href({ view: 'artist', id: artist.id })}
              onClick={(event) => {
                event.preventDefault();
                onNavigate({ view: 'artist', id: artist.id });
              }}
            >
              <div className="card__title">{artist.name}</div>
              <div className="card__meta">
                {plural(artist.trackIds.length, 'track')} · {formatLength(artist.duration)}
              </div>
            </a>
          </div>
        ))}
      </div>
    </>
  );
}

export function ArtistView({
  library,
  id,
  onNavigate,
}: {
  library: Library;
  id: string;
  onNavigate: (route: Route) => void;
}) {
  const player = usePlayer();
  const artist = library.artists.find((entry) => entry.id === id);
  const tracks = useMemo(() => (artist ? tracksOf(library, artist.trackIds) : []), [library, artist]);

  // Which playlists these tracks turn up on, so the page links back out.
  const appearsOn = useMemo(() => {
    if (!artist) return [];
    const ids = new Set(artist.trackIds);
    return library.playlists.filter((playlist) => playlist.trackIds.some((t) => ids.has(t)));
  }, [library, artist]);

  if (!artist) {
    return <p className="panel__empty">No artist by that name in this build.</p>;
  }

  const origin: QueueOrigin = { kind: 'artist', id: artist.id, title: artist.name };

  return (
    <>
      <header className="playlist-head glass glass--lit">
        <div className="playlist-head__art playlist-head__art--round">
          <Cover
            art={artist.art}
            seed={artist.id}
            hue={artist.hue}
            label={artist.name}
            style={{ fontSize: 52 }}
          />
        </div>
        <div className="playlist-head__body">
          <div className="playlist-head__kind">Artist</div>
          <h1>{artist.name}</h1>
          {artist.albums.length > 0 && (
            <p className="playlist-head__desc">{artist.albums.join(' · ')}</p>
          )}
          <div className="playlist-head__meta">
            {plural(tracks.length, 'track')} · {formatLength(artist.duration)}
            {artist.folder && (
              <>
                {' · files in '}
                <code>public/{artist.folder}/</code>
              </>
            )}
          </div>
          <div className="playlist-head__actions">
            <PlayArtist artist={artist} ids={artist.trackIds} big />
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!player.shuffle) player.toggleShuffle();
                player.playContext(artist.trackIds, Math.floor(Math.random() * tracks.length), origin);
              }}
            >
              <ShuffleIcon size={16} />
              Shuffle
            </button>
            <button type="button" className="btn" onClick={() => player.enqueue(artist.trackIds)}>
              Add to queue
            </button>
          </div>
        </div>
      </header>

      <TrackList tracks={tracks} origin={origin} />

      {appearsOn.length > 0 && (
        <section className="view__section">
          <div className="section-head">
            <h2>Appears on</h2>
          </div>
          <div className="chip-row">
            {appearsOn.map((playlist) => (
              <a
                key={playlist.id}
                className="chip chip--link"
                href={href({ view: 'playlist', id: playlist.id })}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate({ view: 'playlist', id: playlist.id });
                }}
              >
                {playlist.title}
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
