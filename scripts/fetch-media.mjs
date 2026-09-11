#!/usr/bin/env node
/**
 * Build-time media pipeline.
 *
 * Reads content/playlists.json, downloads every track URL, reads its tags,
 * optionally re-encodes and waveform-samples it, and writes public/library.json
 * plus the files under public/media/ that the player streams.
 *
 * Downloads are cached in .cache/ and keyed by a hash of the URL, so re-running
 * this is cheap and CI only pays for tracks that were added or changed.
 *
 *   node scripts/fetch-media.mjs [--strict] [--clean] [--refresh] [--config <path>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, ConfigError } from './lib/config.mjs';
import { download, DownloadError } from './lib/download.mjs';
import { hasFfmpeg, imageExtFor, needsTranscode, peaks, readTags, transcode } from './lib/audio.mjs';
import { formatBytes, hueOfHex, hueOfString, keyOf, pool, titleFromUrl } from './lib/util.mjs';
import { color, log } from './lib/log.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const CACHE = {
  audio: path.join(root, '.cache', 'downloads'),
  encoded: path.join(root, '.cache', 'encoded'),
  art: path.join(root, '.cache', 'art'),
  text: path.join(root, '.cache', 'text'),
};
const OUT = {
  media: path.join(root, 'public', 'media'),
  audio: path.join(root, 'public', 'media', 'audio'),
  art: path.join(root, 'public', 'media', 'art'),
  library: path.join(root, 'public', 'library.json'),
};

function parseArgs(argv) {
  const flags = { strict: false, clean: false, refresh: false, config: path.join(root, 'content', 'playlists.json') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') flags.strict = true;
    else if (arg === '--clean') flags.clean = true;
    else if (arg === '--refresh') flags.refresh = true;
    else if (arg === '--config') flags.config = path.resolve(argv[++i] ?? '');
    else if (arg.startsWith('--config=')) flags.config = path.resolve(arg.slice('--config='.length));
    else throw new ConfigError(`unknown argument "${arg}"`);
  }
  return flags;
}

/** LRC -> [{ time, text }], sorted. Lines without a timestamp are dropped. */
function parseLrc(text) {
  const lines = [];
  for (const line of text.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (stamps.length === 0) continue;
    const body = line.replace(/\[[^\]]*\]/g, '').trim();
    if (!body) continue;
    for (const [, m, s, frac] of stamps) {
      const fraction = frac ? Number(`0.${frac}`) : 0;
      lines.push({ time: Number(m) * 60 + Number(s) + fraction, text: body });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

async function publish(source, targetDir, name) {
  await fs.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, name);
  await fs.copyFile(source, target);
  return target;
}

/** Everything the player needs for one track, or null if the source could not be used. */
async function buildTrack(entry, ctx) {
  const { options, refresh, capabilities } = ctx;
  const id = keyOf(entry.url);
  const label = entry.title || titleFromUrl(entry.url);

  let got;
  try {
    got = await download(entry.url, {
      dir: CACHE.audio,
      retries: options.retries,
      timeout: options.timeout,
      refresh,
      accept: 'audio/*,*/*;q=0.8',
    });
  } catch (error) {
    log.fail(`${label} - ${error instanceof DownloadError ? error.message : error}`);
    return null;
  }

  let audioFile = got.file;
  let reencoded = false;
  if (capabilities.ffmpeg && needsTranscode(audioFile, options.transcode)) {
    try {
      const result = await transcode(audioFile, CACHE.encoded, id, options.transcode);
      audioFile = result.file;
      reencoded = !result.fromCache;
    } catch (error) {
      log.warn(`${label} - re-encode failed, publishing the original (${error.message})`);
    }
  }

  const tags = await readTags(audioFile);

  let art;
  if (entry.cover) {
    try {
      const coverFile = await download(entry.cover, {
        dir: CACHE.art,
        retries: options.retries,
        timeout: options.timeout,
        refresh,
        accept: 'image/*',
      });
      const name = `${keyOf(entry.cover)}${path.extname(coverFile.file) || '.jpg'}`;
      await publish(coverFile.file, OUT.art, name);
      art = `media/art/${name}`;
    } catch (error) {
      log.warn(`${label} - cover art could not be fetched (${error.message})`);
    }
  }
  if (!art && tags.picture) {
    const name = `${id}${imageExtFor(tags.picture.format)}`;
    await fs.mkdir(OUT.art, { recursive: true });
    await fs.writeFile(path.join(OUT.art, name), tags.picture.data);
    art = `media/art/${name}`;
  }

  let lyrics;
  if (entry.lyrics) {
    try {
      const lrc = await download(entry.lyrics, {
        dir: CACHE.text,
        retries: options.retries,
        timeout: options.timeout,
        refresh,
      });
      const parsed = parseLrc(await fs.readFile(lrc.file, 'utf8'));
      if (parsed.length > 0) lyrics = parsed;
      else log.warn(`${label} - lyrics file had no [mm:ss] timestamps`);
    } catch (error) {
      log.warn(`${label} - lyrics could not be fetched (${error.message})`);
    }
  }

  let waveform = null;
  if (options.waveform && capabilities.ffmpeg) {
    try {
      waveform = await peaks(audioFile, options.waveformResolution);
    } catch (error) {
      log.warn(`${label} - waveform sampling failed (${error.message})`);
    }
  }

  const ext = path.extname(audioFile);
  await publish(audioFile, OUT.audio, `${id}${ext}`);
  const published = await fs.stat(path.join(OUT.audio, `${id}${ext}`));

  const note = [
    got.fromCache ? 'cached' : `downloaded ${formatBytes(got.bytes)}`,
    reencoded ? `re-encoded to ${ext.slice(1)}` : null,
    waveform ? 'waveform' : null,
  ]
    .filter(Boolean)
    .join(', ');
  log.ok(`${label} ${color.dim(`(${note})`)}`);

  return {
    id,
    source: entry.url,
    src: `media/audio/${id}${ext}`,
    title: entry.title || tags.title || titleFromUrl(entry.url),
    artist: entry.artist || tags.artist || 'Unknown artist',
    album: entry.album || tags.album || undefined,
    year: entry.year || tags.year || undefined,
    genre: tags.genre,
    duration: tags.duration ?? 0,
    bytes: published.size,
    bitrate: tags.bitrate,
    art,
    waveform,
    lyrics,
  };
}

/** Delete published media that no longer belongs to any track, so stale files never ship. */
async function prune(keep) {
  let removed = 0;
  for (const dir of [OUT.audio, OUT.art]) {
    let names;
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const rel = `${path.basename(dir) === 'audio' ? 'media/audio' : 'media/art'}/${name}`;
      if (keep.has(rel)) continue;
      await fs.rm(path.join(dir, name), { force: true });
      removed += 1;
    }
  }
  return removed;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.clean) {
    log.step('Clearing cache and generated media');
    await Promise.all([
      fs.rm(path.join(root, '.cache'), { recursive: true, force: true }),
      fs.rm(OUT.media, { recursive: true, force: true }),
      fs.rm(OUT.library, { force: true }),
    ]);
  }

  const config = await loadConfig(flags.config);
  const ffmpeg = await hasFfmpeg();
  const capabilities = { ffmpeg };

  const trackCount = config.playlists.reduce((n, p) => n + p.tracks.length, 0);
  log.step(`${config.playlists.length} playlists, ${trackCount} track references`);
  if (!ffmpeg) {
    const wanted = [];
    if (config.options.transcode !== 'off') wanted.push('re-encoding');
    if (config.options.waveform) wanted.push('waveforms');
    if (wanted.length) log.warn(`ffmpeg not found - skipping ${wanted.join(' and ')}`);
  }

  // The same URL can appear in several playlists; fetch and describe it once.
  const unique = new Map();
  for (const playlist of config.playlists) {
    for (const track of playlist.tracks) {
      if (!unique.has(track.url)) unique.set(track.url, track);
      else Object.assign(unique.get(track.url), Object.fromEntries(
        Object.entries(track).filter(([, v]) => v !== undefined),
      ));
    }
  }

  log.step(`Fetching ${unique.size} unique sources`);
  const entries = [...unique.values()];
  const built = await pool(entries, config.options.concurrency, (entry) =>
    buildTrack(entry, { options: config.options, refresh: flags.refresh, capabilities }),
  );

  const byUrl = new Map();
  const tracks = [];
  for (const track of built) {
    if (!track) continue;
    byUrl.set(track.source, track);
    tracks.push(track);
  }

  const failed = built.filter((t) => t === null).length;
  if (failed > 0 && flags.strict) {
    // Bail before publishing anything, so --strict never leaves a half-built library.
    throw new ConfigError(`${failed} source(s) could not be fetched (--strict)`);
  }

  const playlists = config.playlists
    .map((playlist) => {
      const ids = playlist.tracks.map((t) => byUrl.get(t.url)?.id).filter(Boolean);
      const members = ids.map((id) => tracks.find((t) => t.id === id));
      // The playlist's colour identity: its configured accent, else one derived from its id.
      const hue = hueOfHex(playlist.accent) ?? hueOfString(playlist.id);
      members.forEach((track, index) => {
        // Tracks keep the hue of the first playlist they appear in, fanned out a
        // little so generated covers vary without leaving the playlist's family.
        if (track.hue === undefined) track.hue = (hue + ((index * 37) % 46) - 23 + 360) % 360;
      });
      return {
        id: playlist.id,
        title: playlist.title,
        description: playlist.description,
        accent: playlist.accent,
        hue,
        cover: playlist.cover ? undefined : members.find((t) => t.art)?.art,
        coverUrl: playlist.cover,
        trackIds: ids,
        duration: Math.round(members.reduce((sum, t) => sum + (t.duration || 0), 0)),
      };
    })
    .filter((playlist) => {
      if (playlist.trackIds.length > 0) return true;
      log.warn(`playlist "${playlist.title}" ended up empty and was dropped`);
      return false;
    });

  if (playlists.length === 0) {
    throw new Error('no playable tracks - every source failed. Check the URLs in content/playlists.json.');
  }

  const keep = new Set();
  for (const track of tracks) {
    keep.add(track.src);
    if (track.art) keep.add(track.art);
  }
  for (const playlist of playlists) if (playlist.cover) keep.add(playlist.cover);
  const removed = await prune(keep);

  const library = {
    generatedAt: new Date().toISOString(),
    site: config.site,
    playlists,
    tracks,
  };
  await fs.mkdir(path.dirname(OUT.library), { recursive: true });
  await fs.writeFile(OUT.library, `${JSON.stringify(library, null, 2)}\n`);

  const totalBytes = tracks.reduce((sum, t) => sum + t.bytes, 0);
  const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  log.step('Library written');
  log.detail(
    `${tracks.length} tracks - ${Math.round(totalSeconds / 60)} min - ${formatBytes(totalBytes)}` +
      (removed ? ` - pruned ${removed} stale file(s)` : ''),
  );

  if (failed > 0) {
    log.warn(`${failed} source(s) could not be fetched; the build continues without them`);
  }
}

main().catch((error) => {
  console.error();
  log.fail(error instanceof ConfigError ? error.message : error.stack || String(error));
  process.exit(1);
});
