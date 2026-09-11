import type { Library } from '../types';
import { useCollections } from '../state/collections';
import { useUi, type Theme } from '../state/ui';
import { formatLength, plural } from '../lib/library';
import { href, type Route } from '../lib/router';
import { Cover, MosaicCover } from './Cover';
import {
  ArtistIcon,
  ClockIcon,
  HeartIcon,
  HomeIcon,
  KeyboardIcon,
  MoonIcon,
  SunIcon,
  UploadIcon,
  WaveIcon,
} from './Icons';

interface Props {
  library: Library;
  route: Route;
  open: boolean;
  onNavigate: (route: Route) => void;
  onShortcuts: () => void;
  onAddMusic: () => void;
}

const THEME_ORDER: Theme[] = ['auto', 'light', 'dark'];

export function Sidebar({ library, route, open, onNavigate, onShortcuts, onAddMusic }: Props) {
  const { liked, recent } = useCollections();
  const { theme, setTheme } = useUi();

  const item = (target: Route, label: string, icon: React.ReactNode, count?: number) => {
    const current = route.view === target.view;
    return (
      <a
        className="nav__item"
        href={href(target)}
        aria-current={current ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(target);
        }}
      >
        {icon}
        {label}
        {count !== undefined && count > 0 && <span className="nav__count">{count}</span>}
      </a>
    );
  };

  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];

  return (
    <nav className="sidebar glass glass--lit" data-open={open} aria-label="Library">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <WaveIcon size={18} />
        </span>
        <span>
          <span className="brand__name">{library.site.title}</span>
          <span className="brand__tag" style={{ display: 'block' }}>
            {library.tracks.length} tracks
          </span>
        </span>
      </div>

      <div className="nav">
        {item({ view: 'home' }, 'Home', <HomeIcon size={17} />)}
        {item({ view: 'liked' }, 'Liked', <HeartIcon size={17} />, liked.length)}
        {item({ view: 'recent' }, 'Recently played', <ClockIcon size={17} />, recent.length)}
        {item({ view: 'artists' }, 'Artists', <ArtistIcon size={17} />, library.artists.length)}
        {item({ view: 'all' }, 'All tracks', <WaveIcon size={17} />, library.tracks.length)}
      </div>

      <div className="sidebar__label">
        Playlists
        <button type="button" className="btn btn--sm btn--icon sidebar__add" aria-label="Add music" onClick={onAddMusic}>
          <UploadIcon size={15} />
        </button>
      </div>
      <div className="sidebar__scroll">
        {library.playlists.map((playlist) => {
          const tracks = playlist.trackIds
            .map((id) => library.tracks.find((track) => track.id === id))
            .filter((track): track is NonNullable<typeof track> => Boolean(track));
          return (
            <a
              key={playlist.id}
              className="playlist-link"
              href={href({ view: 'playlist', id: playlist.id })}
              aria-current={route.view === 'playlist' && route.id === playlist.id ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate({ view: 'playlist', id: playlist.id });
              }}
            >
              <div className="playlist-link__art">
                {playlist.coverUrl ? (
                  <Cover art={playlist.coverUrl} seed={playlist.id} label={playlist.title} hue={playlist.hue} />
                ) : (
                  <MosaicCover tracks={tracks} seed={playlist.id} label={playlist.title} hue={playlist.hue} />
                )}
              </div>
              <div className="playlist-link__text">
                <div className="playlist-link__title">{playlist.title}</div>
                <div className="playlist-link__meta">
                  {plural(playlist.trackIds.length, 'track')} · {formatLength(playlist.duration)}
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <div className="sidebar__foot">
        <button
          type="button"
          className="btn btn--sm btn--icon"
          aria-label={`Theme: ${theme}. Switch to ${nextTheme}.`}
          title={`Theme: ${theme}`}
          onClick={() => setTheme(nextTheme)}
        >
          {theme === 'light' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
        <button type="button" className="btn btn--sm btn--icon" aria-label="Keyboard shortcuts" onClick={onShortcuts}>
          <KeyboardIcon size={16} />
        </button>
        <span className="brand__tag" style={{ marginLeft: 'auto', paddingRight: 4 }}>
          {theme}
        </span>
      </div>
    </nav>
  );
}
