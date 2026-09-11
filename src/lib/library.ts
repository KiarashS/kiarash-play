import type { Library, Track } from '../types';

/** Media paths in library.json are base-relative so the same build works at "/" or "/repo/". */
export function assetUrl(relative: string): string {
  return `${import.meta.env.BASE_URL}${relative.replace(/^\//, '')}`;
}

export async function loadLibrary(signal?: AbortSignal): Promise<Library> {
  const response = await fetch(assetUrl('library.json'), { signal, cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(
      `library.json is missing (HTTP ${response.status}). Run "npm run fetch" to download the tracks listed in content/playlists.json.`,
    );
  }
  const library = (await response.json()) as Library;
  if (!Array.isArray(library.tracks) || library.tracks.length === 0) {
    throw new Error('library.json contains no tracks.');
  }
  return library;
}

export function indexTracks(library: Library): Map<string, Track> {
  return new Map(library.tracks.map((track) => [track.id, track]));
}

/**
 * Deterministic hue pair for a track without cover art. Same id always yields the
 * same gradient, so generated covers look intentional rather than random.
 */
export function hueFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatLength(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Case- and accent-insensitive haystack used by the search overlay. */
export function searchKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
