import fs from 'node:fs/promises';
import { slug } from './util.mjs';

export class ManifestError extends Error {}

const FIELDS = ['url', 'title', 'artist', 'artists', 'album', 'year', 'cover', 'lyrics'];

export async function readManifest(configPath) {
  let text;
  try {
    text = await fs.readFile(configPath, 'utf8');
  } catch {
    throw new ManifestError(`no manifest at ${configPath}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ManifestError(`manifest is not valid JSON - ${error.message}`);
  }
}

export async function writeManifest(configPath, manifest) {
  await fs.writeFile(configPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function cleanTrack(input) {
  const track = {};
  for (const field of FIELDS) {
    const value = input[field];
    if (value === undefined || value === null || value === '') continue;
    if (field === 'artists') {
      const names = (Array.isArray(value) ? value : String(value).split(','))
        .map((name) => String(name).trim())
        .filter(Boolean);
      if (names.length > 0) track.artists = names;
      continue;
    }
    track[field] = typeof value === 'string' ? value.trim() : value;
  }
  if (!track.url || !/^https?:\/\//i.test(track.url)) {
    throw new ManifestError('a track needs an http(s) URL');
  }
  // A credit line was not given but the names were: derive one rather than
  // falling back to whatever the file's tags happen to say.
  if (!track.artist && track.artists) track.artist = track.artists.join(' & ');
  return track;
}

/**
 * Add one track to one or more playlists, creating playlists that do not exist yet.
 * Targets are ids or titles; an unknown target becomes a new playlist with that title.
 * Adding a track that a playlist already lists updates it in place, so re-adding
 * with better metadata is a correction rather than a duplicate.
 */
export function addTrackToManifest(manifest, input, targets) {
  const track = cleanTrack(input);
  const wanted = (Array.isArray(targets) ? targets : [targets])
    .map((t) => (typeof t === 'string' ? { target: t } : t))
    .map(({ target, accent, description }) => ({
      target: String(target ?? '').trim(),
      accent,
      description,
    }))
    .filter((t) => t.target);

  if (wanted.length === 0) throw new ManifestError('pick at least one playlist');

  manifest.playlists ??= [];
  const result = { track, added: [], updated: [], created: [] };

  for (const { target, accent, description } of wanted) {
    const id = slug(target);
    let playlist = manifest.playlists.find((p) => slug(p.id || p.title) === id);

    if (!playlist) {
      playlist = {
        id,
        title: target,
        description: description ?? '',
        ...(accent ? { accent } : {}),
        tracks: [],
      };
      manifest.playlists.push(playlist);
      result.created.push({ id, title: target });
    }

    playlist.tracks ??= [];
    const at = playlist.tracks.findIndex(
      (existing) => (typeof existing === 'string' ? existing : existing.url) === track.url,
    );
    if (at === -1) {
      playlist.tracks.push(track);
      result.added.push(playlist.id ?? id);
    } else {
      playlist.tracks[at] = track;
      result.updated.push(playlist.id ?? id);
    }
  }

  return result;
}

/** Remove a track URL from a playlist, or from every playlist when none is named. */
export function removeTrackFromManifest(manifest, url, playlistId) {
  const removed = [];
  for (const playlist of manifest.playlists ?? []) {
    const id = slug(playlist.id || playlist.title);
    if (playlistId && id !== slug(playlistId)) continue;
    const before = playlist.tracks.length;
    playlist.tracks = playlist.tracks.filter(
      (track) => (typeof track === 'string' ? track : track.url) !== url,
    );
    if (playlist.tracks.length < before) removed.push(id);
  }
  // A playlist with no tracks left fails validation, so drop it.
  manifest.playlists = (manifest.playlists ?? []).filter((playlist) => playlist.tracks.length > 0);
  return removed;
}

/** Summary of the manifest for the uploader's playlist picker. */
export function describeManifest(manifest) {
  return (manifest.playlists ?? []).map((playlist) => ({
    id: slug(playlist.id || playlist.title),
    title: playlist.title,
    trackCount: playlist.tracks?.length ?? 0,
  }));
}
