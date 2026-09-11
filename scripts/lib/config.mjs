import fs from 'node:fs/promises';
import path from 'node:path';
import { slug } from './util.mjs';

const DEFAULT_OPTIONS = {
  /** How many downloads run at once. */
  concurrency: 4,
  /** Attempts per URL before giving up (1 = no retry). */
  retries: 3,
  /** Seconds before a stalled download is aborted. */
  timeout: 120,
  /**
   * "auto"  - re-encode only formats that browsers disagree about (ogg, flac, wav, ...)
   * "mp3" / "m4a" - always re-encode to that format
   * "off"   - never re-encode
   * Needs ffmpeg on PATH; without it the original file is published unchanged.
   */
  transcode: 'auto',
  /** Sample the audio into peak values so the seek bar can draw a waveform. Needs ffmpeg. */
  waveform: true,
  /** Peak buckets stored per track. */
  waveformResolution: 160,
};

const DEFAULT_SITE = {
  title: 'Kiarash Play',
  tagline: 'A small, fast, offline-capable music player.',
};

class ConfigError extends Error {}

function fail(where, message) {
  throw new ConfigError(`${where}: ${message}`);
}

function normaliseTrack(raw, where) {
  const track = typeof raw === 'string' ? { url: raw } : { ...raw };
  if (!track.url || typeof track.url !== 'string') {
    fail(where, 'every track needs a "url" (or be a bare URL string)');
  }
  const url = track.url.trim();
  if (!/^https?:\/\//i.test(url)) {
    fail(where, `"${url}" is not an http(s) URL. Local files belong in content/local/.`);
  }
  return {
    url,
    title: track.title?.trim() || undefined,
    artist: track.artist?.trim() || undefined,
    album: track.album?.trim() || undefined,
    year: track.year ?? undefined,
    // Optional overrides fetched alongside the audio.
    cover: track.cover?.trim() || undefined,
    lyrics: track.lyrics?.trim() || undefined,
  };
}

export async function loadConfig(configPath) {
  let text;
  try {
    text = await fs.readFile(configPath, 'utf8');
  } catch {
    fail(path.basename(configPath), 'file not found - expected a playlist manifest at this path');
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    fail(path.basename(configPath), `invalid JSON - ${error.message}`);
  }

  if (!Array.isArray(raw.playlists) || raw.playlists.length === 0) {
    fail(path.basename(configPath), 'expected a non-empty "playlists" array');
  }

  const seenIds = new Set();
  const playlists = raw.playlists.map((playlist, index) => {
    const where = `playlists[${index}]`;
    if (!playlist.title) fail(where, 'needs a "title"');
    const id = slug(playlist.id || playlist.title, `playlist-${index + 1}`);
    if (seenIds.has(id)) fail(where, `duplicate playlist id "${id}"`);
    seenIds.add(id);

    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    if (tracks.length === 0) fail(where, `playlist "${playlist.title}" has no tracks`);

    return {
      id,
      title: String(playlist.title).trim(),
      description: playlist.description?.trim() || '',
      cover: playlist.cover?.trim() || undefined,
      accent: playlist.accent?.trim() || undefined,
      tracks: tracks.map((track, i) => normaliseTrack(track, `${where}.tracks[${i}]`)),
    };
  });

  const options = { ...DEFAULT_OPTIONS, ...(raw.options || {}) };
  if (!['auto', 'off', 'mp3', 'm4a'].includes(options.transcode)) {
    fail('options.transcode', 'must be one of "auto", "off", "mp3", "m4a"');
  }
  options.concurrency = Math.max(1, Math.min(16, Number(options.concurrency) || 4));
  options.retries = Math.max(1, Math.min(8, Number(options.retries) || 3));
  options.waveformResolution = Math.max(32, Math.min(512, Number(options.waveformResolution) || 160));

  return {
    site: { ...DEFAULT_SITE, ...(raw.site || {}) },
    options,
    playlists,
  };
}

export { ConfigError };
