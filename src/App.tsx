import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Library } from './types';
import { assetUrl, hueFor, indexTracks, loadLibrary } from './lib/library';
import { accentFromImage, applyAccent } from './lib/accent';
import { useRoute } from './lib/router';
import { PlayerProvider, usePlayer } from './player/PlayerContext';
import { useShortcuts } from './player/useShortcuts';
import { useCollections } from './state/collections';
import { useUi } from './state/ui';
import { Backdrop } from './components/Backdrop';
import { Sidebar } from './components/Sidebar';
import { Dock } from './components/Dock';
import { SidePanel } from './components/SidePanel';
import { Stage } from './components/Stage';
import { SearchOverlay } from './components/SearchOverlay';
import { ShortcutsOverlay } from './components/ShortcutsOverlay';
import { CollectionView, HomeView, PlaylistView } from './components/Views';
import { ArtistsView, ArtistView } from './components/ArtistViews';
import { AddMusic, probeStudio } from './components/AddMusic';
import { MenuIcon, SearchIcon, UploadIcon } from './components/Icons';

export function App() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { markPlayed } = useCollections();

  const reload = useCallback(() => {
    loadLibrary()
      .then(setLibrary)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadLibrary(controller.signal)
      .then(setLibrary)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  const tracks = useMemo(() => (library ? indexTracks(library) : new Map()), [library]);

  if (error) {
    return (
      <div className="boot">
        <Backdrop playing={false} />
        <div className="boot__error glass glass--lit" style={{ padding: 26 }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>No library to play</h1>
          <p>{error}</p>
          <code>npm run fetch</code>
        </div>
      </div>
    );
  }

  if (!library) {
    return (
      <div className="boot">
        <Backdrop playing={false} />
        <div className="boot__ring" />
        <p style={{ color: 'var(--text-faint)' }}>Loading library</p>
      </div>
    );
  }

  return (
    <PlayerProvider tracks={tracks} onPlayed={markPlayed}>
      <Shell library={library} onLibraryChanged={reload} />
    </PlayerProvider>
  );
}

function Shell({ library, onLibraryChanged }: { library: Library; onLibraryChanged: () => void }) {
  const player = usePlayer();
  const { toast } = useUi();
  const [route, navigate] = useRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panel, setPanel] = useState<'queue' | 'lyrics' | null>(null);
  const [stage, setStage] = useState(false);
  const [search, setSearch] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [adding, setAdding] = useState(false);
  const [studio, setStudio] = useState<Awaited<ReturnType<typeof probeStudio>>>(null);

  const track = player.current;

  // The uploader's API only exists on the local dev/preview server.
  useEffect(() => {
    probeStudio().then(setStudio);
  }, [library.generatedAt]);

  // Tint the whole interface: the artwork of whatever is playing, else the colour
  // of the playlist it came from, else the one you are looking at.
  useEffect(() => {
    let cancelled = false;
    const contextHue =
      library.playlists.find((playlist) => playlist.id === player.origin?.id)?.hue ??
      library.artists.find((artist) => artist.id === player.origin?.id)?.hue ??
      (route.view === 'playlist'
        ? library.playlists.find((playlist) => playlist.id === route.id)?.hue
        : route.view === 'artist'
          ? library.artists.find((artist) => artist.id === route.id)?.hue
          : undefined);

    const fallback = () => {
      const hue = track?.hue ?? contextHue ?? hueFor(library.playlists[0]?.id ?? '');
      applyAccent({ h: hue, s: 76, l: 66 });
    };

    if (!track?.art) {
      fallback();
      return;
    }
    const url = /^https?:\/\//i.test(track.art) ? track.art : assetUrl(track.art);
    accentFromImage(url).then((accent) => {
      if (cancelled) return;
      if (accent) applyAccent(accent);
      else fallback();
    });
    return () => {
      cancelled = true;
    };
  }, [track, library.playlists, library.artists, player.origin, route]);

  useEffect(() => {
    document.title = track ? `${track.title} — ${track.artist}` : library.site.title;
  }, [track, library.site.title]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [route]);

  const toggleLyrics = useCallback(() => setPanel((value) => (value === 'lyrics' ? null : 'lyrics')), []);
  const toggleQueue = useCallback(() => setPanel((value) => (value === 'queue' ? null : 'queue')), []);

  useShortcuts({
    onSearch: () => setSearch(true),
    onQueue: toggleQueue,
    onLyrics: toggleLyrics,
    onStage: () => setStage((value) => !value),
    onShortcuts: () => setShortcuts((value) => !value),
  });

  return (
    <>
      <Backdrop playing={player.isPlaying} />

      <div className="app" data-panel={panel ?? undefined}>
        <Sidebar
          library={library}
          route={route}
          open={sidebarOpen}
          onNavigate={navigate}
          onShortcuts={() => setShortcuts(true)}
          onAddMusic={() => setAdding(true)}
        />
        {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

        <main className="main">
          <header className="topbar glass glass--lit">
            <button
              type="button"
              className="btn btn--icon mobile-only"
              aria-label="Open library"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon size={18} />
            </button>

            <button type="button" className="search-field" onClick={() => setSearch(true)}>
              <SearchIcon size={16} />
              <span className="search-field__label">Search tracks, artists, playlists</span>
              <span className="search-field__hint desktop-only">⌘K</span>
            </button>

            <div className="topbar__spacer" />

            {player.sleepTimer && (
              <span className="chip desktop-only">Sleeping in {player.sleepTimer.label}</span>
            )}
            {player.error && <span className="chip">{player.error}</span>}

            <button type="button" className="btn desktop-only" onClick={() => setAdding(true)}>
              <UploadIcon size={16} />
              Add music
            </button>
          </header>

          <div
            className="view"
            key={`${route.view}-${'id' in route ? route.id : ''}`}
          >
            {route.view === 'home' && <HomeView library={library} onNavigate={navigate} />}
            {route.view === 'playlist' && <PlaylistView library={library} id={route.id} />}
            {route.view === 'artists' && <ArtistsView library={library} onNavigate={navigate} />}
            {route.view === 'artist' && (
              <ArtistView library={library} id={route.id} onNavigate={navigate} />
            )}
            {route.view === 'liked' && <CollectionView library={library} kind="liked" />}
            {route.view === 'recent' && <CollectionView library={library} kind="recent" />}
            {route.view === 'all' && <CollectionView library={library} kind="all" />}
          </div>
        </main>

        <Dock panel={panel} onPanelChange={setPanel} onExpand={() => setStage(true)} />
      </div>

      {panel && <SidePanel kind={panel} onClose={() => setPanel(null)} />}
      {stage && <Stage onClose={() => setStage(false)} />}
      {search && <SearchOverlay library={library} onClose={() => setSearch(false)} onNavigate={navigate} />}
      {shortcuts && <ShortcutsOverlay onClose={() => setShortcuts(false)} />}
      {adding && (
        <AddMusic
          library={library}
          studio={studio}
          onClose={() => setAdding(false)}
          onAdded={onLibraryChanged}
        />
      )}
      {toast && <div className="toast glass glass--lit">{toast}</div>}
    </>
  );
}
