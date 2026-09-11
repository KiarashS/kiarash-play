import { useEffect, useMemo, useRef, useState } from 'react';
import type { Library } from '../types';
import { useUi } from '../state/ui';
import { CloseIcon, UploadIcon } from './Icons';

interface StudioState {
  enabled: boolean;
  configPath: string;
  playlists: { id: string; title: string; trackCount: number }[];
}

interface AddResult {
  track: { title: string; artist: string; src: string };
  added: string[];
  updated: string[];
  created: { id: string; title: string }[];
  pipeline: { trackCount: number; artistCount: number };
}

const STUDIO = `${import.meta.env.BASE_URL}__studio/`.replace(/\/+/g, '/');

/** The uploader's API only exists on the dev and preview servers. */
export async function probeStudio(): Promise<StudioState | null> {
  try {
    const response = await fetch(`${STUDIO}state`, { cache: 'no-store' });
    if (!response.ok) return null;
    const state = (await response.json()) as StudioState;
    return state.enabled ? state : null;
  } catch {
    return null;
  }
}

export function AddMusic({
  library,
  studio,
  onClose,
  onAdded,
}: {
  library: Library;
  studio: StudioState | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { notify } = useUi();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artists, setArtists] = useState('');
  const [album, setAlbum] = useState('');
  const [cover, setCover] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [newPlaylist, setNewPlaylist] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  const playlists = studio?.playlists ?? library.playlists.map((p) => ({
    id: p.id,
    title: p.title,
    trackCount: p.trackIds.length,
  }));

  const targets = useMemo(
    () => [...chosen, ...(newPlaylist.trim() ? [newPlaylist.trim()] : [])],
    [chosen, newPlaylist],
  );

  const payload = useMemo(() => {
    const names = artists
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    return {
      url: url.trim(),
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(names.length ? { artists: names, artist: names.join(' & ') } : {}),
      ...(album.trim() ? { album: album.trim() } : {}),
      ...(cover.trim() ? { cover: cover.trim() } : {}),
      ...(lyrics.trim() ? { lyrics: lyrics.trim() } : {}),
    };
  }, [url, title, artists, album, cover, lyrics]);

  const ready = /^https?:\/\/\S+$/i.test(payload.url) && targets.length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${STUDIO}add`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, playlists: targets }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setResult(body as AddResult);
      notify(`Added "${(body as AddResult).track.title}"`);
      onAdded();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const snippet = JSON.stringify({ ...payload, playlists: targets }, null, 2);

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add music"
      onPointerDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="overlay__card glass glass--lit" style={{ maxHeight: '84vh' }}>
        <div className="overlay__input">
          <UploadIcon size={18} />
          <strong style={{ fontSize: 15, flex: 1 }}>Add music by URL</strong>
          <button type="button" className="btn btn--sm btn--icon" aria-label="Close" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        {result ? (
          <div className="form">
            <p className="form__note form__note--ok">
              <strong>{result.track.title}</strong> by {result.track.artist} is in the library.
            </p>
            <dl className="form__facts">
              <div>
                <dt>Filed as</dt>
                <dd>
                  <code>public/{result.track.src}</code>
                </dd>
              </div>
              <div>
                <dt>Playlists</dt>
                <dd>{[...result.added, ...result.updated].join(', ') || 'none'}</dd>
              </div>
              {result.created.length > 0 && (
                <div>
                  <dt>Created</dt>
                  <dd>{result.created.map((p) => p.title).join(', ')}</dd>
                </div>
              )}
              <div>
                <dt>Library</dt>
                <dd>
                  {result.pipeline.trackCount} tracks · {result.pipeline.artistCount} artists
                </dd>
              </div>
            </dl>
            <div className="form__actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setResult(null);
                  setUrl('');
                  setTitle('');
                  setAlbum('');
                  setCover('');
                  setLyrics('');
                  urlRef.current?.focus();
                }}
              >
                Add another
              </button>
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="form">
            {!studio && (
              <p className="form__note">
                The uploader writes into the repository, so it only runs against the local
                server — <code>npm run dev</code> or <code>npm run preview</code>. On a published
                site, fill this in and paste the snippet at the bottom into{' '}
                <code>content/playlists.json</code>.
              </p>
            )}

            <label className="field">
              <span>Music URL</span>
              <input
                ref={urlRef}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/song.mp3"
                spellCheck={false}
                autoComplete="off"
              />
              <small>A direct link to an audio file. Tags are read from the file itself.</small>
            </label>

            <div className="field-row">
              <label className="field">
                <span>Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="From the file's tags"
                />
              </label>
              <label className="field">
                <span>Artists</span>
                <input
                  value={artists}
                  onChange={(event) => setArtists(event.target.value)}
                  placeholder="Comma separated"
                />
                <small>Each name gets its own page and folder.</small>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Album</span>
                <input value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Optional" />
              </label>
              <label className="field">
                <span>Cover image URL</span>
                <input
                  value={cover}
                  onChange={(event) => setCover(event.target.value)}
                  placeholder="Optional"
                  spellCheck={false}
                />
              </label>
            </div>

            <label className="field">
              <span>Lyrics (.lrc) URL</span>
              <input
                value={lyrics}
                onChange={(event) => setLyrics(event.target.value)}
                placeholder="Optional, timestamped lyrics"
                spellCheck={false}
              />
            </label>

            <fieldset className="field">
              <legend>Playlists</legend>
              <div className="checks">
                {playlists.map((playlist) => (
                  <label key={playlist.id} className="check">
                    <input
                      type="checkbox"
                      checked={chosen.includes(playlist.id)}
                      onChange={(event) =>
                        setChosen((prev) =>
                          event.target.checked
                            ? [...prev, playlist.id]
                            : prev.filter((id) => id !== playlist.id),
                        )
                      }
                    />
                    <span>{playlist.title}</span>
                    <span className="check__count">{playlist.trackCount}</span>
                  </label>
                ))}
              </div>
              <input
                value={newPlaylist}
                onChange={(event) => setNewPlaylist(event.target.value)}
                placeholder="…or type a new playlist name"
              />
              <small>A track can sit in as many playlists as you like; the file is stored once.</small>
            </fieldset>

            {error && <p className="form__note form__note--bad">{error}</p>}

            {!studio && ready && (
              <label className="field">
                <span>Manifest entry</span>
                <textarea readOnly rows={8} value={snippet} onFocus={(e) => e.currentTarget.select()} />
              </label>
            )}

            <div className="form__actions">
              <span className="brand__tag">
                {targets.length === 0
                  ? 'Pick at least one playlist'
                  : `Adding to ${targets.join(', ')}`}
              </span>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!ready || busy || !studio}
                onClick={submit}
              >
                {busy ? 'Fetching…' : 'Add to library'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
