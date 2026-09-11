import { useMemo } from 'react';
import type { Library, Playlist, QueueOrigin, Track } from '../types';
import { usePlayer } from '../player/PlayerContext';
import { useCollections } from '../state/collections';
import { formatLength, plural } from '../lib/library';
import type { Route } from '../lib/router';
import { Cover, MosaicCover } from './Cover';
import { TrackList } from './TrackList';
import { HeartIcon, PauseIcon, PlayIcon, ShuffleIcon } from './Icons';

function tracksOf(library: Library, ids: string[]): Track[] {
  const index = new Map(library.tracks.map((track) => [track.id, track]));
  return ids.map((id) => index.get(id)).filter((track): track is Track => Boolean(track));
}

function PlayButton({ ids, origin, big }: { ids: string[]; origin: QueueOrigin; big?: boolean }) {
  const player = usePlayer();
  const active = player.origin?.kind === origin.kind && player.origin?.id === origin.id;
  const playing = active && player.isPlaying;

  return (
    <button
      type="button"
      className="btn--play"
      style={big ? { width: 56, height: 56 } : undefined}
      aria-label={playing ? `Pause ${origin.title}` : `Play ${origin.title}`}
      disabled={ids.length === 0}
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

function PlaylistCard({ playlist, library, onOpen }: { playlist: Playlist; library: Library; onOpen: () => void }) {
  const tracks = tracksOf(library, playlist.trackIds);
  return (
    <div className="card glass glass--lit">
      <div className="card__art">
        {playlist.coverUrl ? (
          <Cover art={playlist.coverUrl} seed={playlist.id} label={playlist.title} hue={playlist.hue} style={{ fontSize: 40 }} />
        ) : (
          <MosaicCover tracks={tracks} seed={playlist.id} label={playlist.title} hue={playlist.hue} />
        )}
        <span className="card__play">
          <PlayButton ids={playlist.trackIds} origin={{ kind: 'playlist', id: playlist.id, title: playlist.title }} />
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        style={{ textAlign: 'left', display: 'block', width: '100%' }}
        aria-label={`Open ${playlist.title}`}
      >
        <div className="card__title">{playlist.title}</div>
        <div className="card__meta">
          {playlist.description || `${plural(playlist.trackIds.length, 'track')} · ${formatLength(playlist.duration)}`}
        </div>
      </button>
    </div>
  );
}

export function HomeView({ library, onNavigate }: { library: Library; onNavigate: (route: Route) => void }) {
  const { recent } = useCollections();
  const recentTracks = useMemo(() => tracksOf(library, recent).slice(0, 8), [library, recent]);
  const totalMinutes = Math.round(library.tracks.reduce((sum, track) => sum + track.duration, 0) / 60);
  const artists = new Set(library.tracks.map((track) => track.artist)).size;

  return (
    <>
      <header className="hero glass glass--lit">
        <h1>{library.site.title}</h1>
        <p>{library.site.tagline}</p>
        <div className="hero__stats">
          <span className="chip">{library.playlists.length} playlists</span>
          <span className="chip">{library.tracks.length} tracks</span>
          <span className="chip">{artists} artists</span>
          <span className="chip">{totalMinutes} minutes</span>
          <span className="chip">built {new Date(library.generatedAt).toLocaleDateString()}</span>
        </div>
      </header>

      {recentTracks.length > 0 && (
        <section className="view__section">
          <div className="section-head">
            <h2>Jump back in</h2>
            <p>Where you left off</p>
          </div>
          <TrackList tracks={recentTracks} origin={{ kind: 'all', id: 'recent', title: 'Recently played' }} />
        </section>
      )}

      <section className="view__section">
        <div className="section-head">
          <h2>Playlists</h2>
          <p>Fetched from the URLs in content/playlists.json</p>
        </div>
        <div className="card-grid">
          {library.playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              library={library}
              onOpen={() => onNavigate({ view: 'playlist', id: playlist.id })}
            />
          ))}
        </div>
      </section>
    </>
  );
}

export function PlaylistView({ library, id }: { library: Library; id: string }) {
  const player = usePlayer();
  const playlist = library.playlists.find((entry) => entry.id === id);
  const tracks = useMemo(() => (playlist ? tracksOf(library, playlist.trackIds) : []), [library, playlist]);

  if (!playlist) {
    return <p className="panel__empty">That playlist is not in this build.</p>;
  }

  const origin: QueueOrigin = { kind: 'playlist', id: playlist.id, title: playlist.title };

  return (
    <>
      <header className="playlist-head glass glass--lit">
        <div className="playlist-head__art">
          {playlist.coverUrl ? (
            <Cover art={playlist.coverUrl} seed={playlist.id} label={playlist.title} hue={playlist.hue} style={{ fontSize: 52 }} />
          ) : (
            <MosaicCover tracks={tracks} seed={playlist.id} label={playlist.title} hue={playlist.hue} />
          )}
        </div>
        <div className="playlist-head__body">
          <div className="playlist-head__kind">Playlist</div>
          <h1>{playlist.title}</h1>
          {playlist.description && <p className="playlist-head__desc">{playlist.description}</p>}
          <div className="playlist-head__meta">
            {plural(tracks.length, 'track')} · {formatLength(playlist.duration)}
          </div>
          <div className="playlist-head__actions">
            <PlayButton ids={playlist.trackIds} origin={origin} big />
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!player.shuffle) player.toggleShuffle();
                player.playContext(playlist.trackIds, Math.floor(Math.random() * tracks.length), origin);
              }}
            >
              <ShuffleIcon size={16} />
              Shuffle
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => player.enqueue(playlist.trackIds)}
            >
              Add to queue
            </button>
          </div>
        </div>
      </header>

      <TrackList tracks={tracks} origin={origin} />
    </>
  );
}

export function CollectionView({
  library,
  kind,
}: {
  library: Library;
  kind: 'liked' | 'recent' | 'all';
}) {
  const { liked, recent } = useCollections();

  const { title, description, tracks } = useMemo(() => {
    if (kind === 'liked') {
      return {
        title: 'Liked',
        description: 'Tracks you marked with the heart. Stored in this browser.',
        tracks: tracksOf(library, liked),
      };
    }
    if (kind === 'recent') {
      return {
        title: 'Recently played',
        description: 'The last thirty tracks you started, newest first.',
        tracks: tracksOf(library, recent),
      };
    }
    return {
      title: 'All tracks',
      description: `Everything in this build, sorted by artist.`,
      tracks: [...library.tracks].sort(
        (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      ),
    };
  }, [kind, library, liked, recent]);

  const origin: QueueOrigin = { kind: kind === 'all' ? 'all' : kind, id: kind, title };
  const duration = tracks.reduce((sum, track) => sum + track.duration, 0);

  return (
    <>
      <header className="playlist-head glass glass--lit">
        <div className="playlist-head__art">
          {kind === 'liked' ? (
            <div className="cover" style={{ ['--cover-h' as string]: 340 }}>
              <span className="cover__glyph" style={{ fontSize: 52 }}>
                <HeartIcon size={64} filled />
              </span>
            </div>
          ) : (
            <MosaicCover tracks={tracks} seed={kind} label={title} />
          )}
        </div>
        <div className="playlist-head__body">
          <div className="playlist-head__kind">Collection</div>
          <h1>{title}</h1>
          <p className="playlist-head__desc">{description}</p>
          <div className="playlist-head__meta">
            {plural(tracks.length, 'track')} · {formatLength(duration)}
          </div>
          {tracks.length > 0 && (
            <div className="playlist-head__actions">
              <PlayButton ids={tracks.map((track) => track.id)} origin={origin} big />
            </div>
          )}
        </div>
      </header>

      {tracks.length === 0 ? (
        <p className="panel__empty">
          {kind === 'liked' ? 'No liked tracks yet. Press H while a track plays.' : 'Nothing here yet.'}
        </p>
      ) : (
        <TrackList tracks={tracks} origin={origin} />
      )}
    </>
  );
}
