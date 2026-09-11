import { useEffect, useMemo, useRef, useState } from 'react';
import type { Library, QueueOrigin, Track } from '../types';
import { usePlayer } from '../player/PlayerContext';
import { searchKey } from '../lib/library';
import { href, type Route } from '../lib/router';
import { Cover } from './Cover';
import { CloseIcon, SearchIcon } from './Icons';

interface Props {
  library: Library;
  onClose: () => void;
  onNavigate: (route: Route) => void;
}

type Result =
  | { kind: 'track'; track: Track; score: number }
  | { kind: 'playlist'; id: string; title: string; subtitle: string; art?: string; hue?: number; score: number };

const LIMIT = 40;

/** Word-prefix matching: "sat gym" finds "Satie Gymnopedie". */
function score(haystack: string, terms: string[]): number {
  let total = 0;
  for (const term of terms) {
    const at = haystack.indexOf(term);
    if (at === -1) return -1;
    // Matches at a word boundary are worth more than matches inside a word.
    total += at === 0 ? 3 : haystack[at - 1] === ' ' ? 2 : 1;
  }
  return total;
}

export function SearchOverlay({ library, onClose, onNavigate }: Props) {
  const player = usePlayer();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const haystacks = useMemo(() => {
    const tracks = library.tracks.map((track) => ({
      track,
      key: searchKey([track.title, track.artist, track.album ?? '', track.genre ?? ''].join(' ')),
    }));
    const playlists = library.playlists.map((playlist) => ({
      playlist,
      key: searchKey(`${playlist.title} ${playlist.description}`),
    }));
    return { tracks, playlists };
  }, [library]);

  const results = useMemo<Result[]>(() => {
    const terms = searchKey(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const out: Result[] = [];
    for (const { playlist, key } of haystacks.playlists) {
      const value = score(key, terms);
      if (value >= 0) {
        out.push({
          kind: 'playlist',
          id: playlist.id,
          title: playlist.title,
          subtitle: `${playlist.trackIds.length} tracks`,
          art: playlist.coverUrl ?? playlist.cover,
          hue: playlist.hue,
          score: value + 1.5,
        });
      }
    }
    for (const { track, key } of haystacks.tracks) {
      const value = score(key, terms);
      if (value >= 0) out.push({ kind: 'track', track, score: value });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, LIMIT);
  }, [query, haystacks]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const node = listRef.current?.children[selected] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const open = (result: Result) => {
    if (result.kind === 'playlist') {
      onNavigate({ view: 'playlist', id: result.id });
    } else {
      const origin: QueueOrigin = { kind: 'search', title: `Search: ${query}` };
      const ids = results.filter((r): r is Extract<Result, { kind: 'track' }> => r.kind === 'track').map((r) => r.track.id);
      player.playContext(ids, ids.indexOf(result.track.id), origin);
    }
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      setSelected((i) => Math.min(i + 1, results.length - 1));
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      setSelected((i) => Math.max(i - 1, 0));
      event.preventDefault();
    } else if (event.key === 'Enter' && results[selected]) {
      open(results[selected]);
      event.preventDefault();
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Search" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="overlay__card glass glass--lit" onKeyDown={onKeyDown}>
        <div className="overlay__input">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tracks, artists, albums, playlists"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn--sm btn--icon" aria-label="Close search" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="overlay__results" ref={listRef}>
          {query.trim() === '' ? (
            <p className="panel__empty">Type to search {library.tracks.length} tracks.</p>
          ) : results.length === 0 ? (
            <p className="panel__empty">Nothing matches "{query}".</p>
          ) : (
            results.map((result, index) => (
              <button
                key={result.kind === 'track' ? result.track.id : `p-${result.id}`}
                type="button"
                className="result"
                data-selected={index === selected}
                onPointerEnter={() => setSelected(index)}
                onClick={() => open(result)}
              >
                <div className="result__art">
                  {result.kind === 'track' ? (
                    <Cover art={result.track.art} seed={result.track.id} label={result.track.title} hue={result.track.hue} />
                  ) : (
                    <Cover art={result.art} seed={result.id} label={result.title} hue={result.hue} />
                  )}
                </div>
                <div className="result__text">
                  <div className="track__title">{result.kind === 'track' ? result.track.title : result.title}</div>
                  <div className="track__artist">
                    {result.kind === 'track' ? result.track.artist : result.subtitle}
                  </div>
                </div>
                <span className="result__kind">{result.kind}</span>
              </button>
            ))
          )}
        </div>

        <div className="overlay__input" style={{ borderBottom: 0, borderTop: '1px solid var(--glass-stroke)', padding: '10px 20px' }}>
          <span className="result__kind">
            <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>↵</kbd> to open · <kbd>esc</kbd> to close
          </span>
          <a className="result__kind" style={{ marginLeft: 'auto' }} href={href({ view: 'all' })} onClick={onClose}>
            Browse everything
          </a>
        </div>
      </div>
    </div>
  );
}
