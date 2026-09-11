/**
 * The build-time media pipeline, as a function.
 *
 * scripts/fetch-media.mjs is the command line over this; the uploader's dev API
 * calls it directly so that adding a track from the player does exactly what
 * running the build does.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, ConfigError } from './config.mjs';
import { download, DownloadError } from './download.mjs';
import { hasFfmpeg, imageExtFor, needsTranscode, peaks, readTags, transcode } from './audio.mjs';
import { formatBytes, hueOfHex, hueOfString, keyOf, pool, slug, titleFromUrl } from './util.mjs';
import { captureLog, color, log } from './log.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
const CACHE = {
  audio: path.join(root, '.cache', 'downloads'),
  encoded: path.join(root, '.cache', 'encoded'),
  art: path.join(root, '.cache', 'art'),
  text: path.join(root, '.cache', 'text'),
};
const OUT = {
  // Audio is filed by artist so the published tree is browsable on its own:
  // public/songs/artists/<artist>/<track>.mp3
  songs: path.join(root, 'public', 'songs'),
  // Where audio lived before it was filed by artist; swept away on sight.
  legacy: path.join(root, 'public', 'media'),
  artists: path.join(root, 'public', 'songs', 'artists'),
  library: path.join(root, 'public', 'library.json'),
};

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

/**
 * Split a display credit into the people who should get their own page.
 * Only unambiguous separators are used; a comma is left alone because credits
 * like "J. S. Bach, John Michel (cello)" are one line about two different roles
 * and guessing wrong scatters a catalogue across bogus artist pages. List the
 * names explicitly with "artists" in the manifest when the split matters.
 */
function splitCredit(credit) {
  return credit
    .split(/\s*(?:;|\sfeat\.\s|\sft\.\s|\s&\s|\svs\.?\s)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Reserve "<artist>/<track>" so two tracks never claim the same published path. */
function reservePath(taken, artistSlug, titleSlug, key) {
  let candidate = `${artistSlug}/${titleSlug}`;
  if (taken.has(candidate)) candidate = `${artistSlug}/${titleSlug}-${key.slice(0, 6)}`;
  taken.add(candidate);
  return candidate;
}

async function publish(source, targetDir, name) {
  await fs.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, name);
  await fs.copyFile(source, target);
  return target;
}

/** Everything the player needs for one track, or null if the source could not be used. */
async function buildTrack(entry, ctx) {
  const { options, refresh, capabilities, taken } = ctx;
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

  const title = entry.title || tags.title || titleFromUrl(entry.url);
  const credit = entry.artist || tags.artist || 'Unknown artist';
  const artists = entry.artists ?? splitCredit(credit);
  const artistSlug = slug(artists[0], 'unknown-artist');
  const stem = reservePath(taken, artistSlug, slug(title, id), id);
  const artistDir = path.join(OUT.artists, artistSlug);

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
      const ext = path.extname(coverFile.file) || '.jpg';
      await publish(coverFile.file, artistDir, `${path.basename(stem)}${ext}`);
      art = `songs/artists/${stem}${ext}`;
    } catch (error) {
      log.warn(`${label} - cover art could not be fetched (${error.message})`);
    }
  }
  if (!art && tags.picture) {
    const ext = imageExtFor(tags.picture.format);
    await fs.mkdir(artistDir, { recursive: true });
    await fs.writeFile(path.join(artistDir, `${path.basename(stem)}${ext}`), tags.picture.data);
    art = `songs/artists/${stem}${ext}`;
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
  await publish(audioFile, artistDir, `${path.basename(stem)}${ext}`);
  const published = await fs.stat(path.join(artistDir, `${path.basename(stem)}${ext}`));

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
    src: `songs/artists/${stem}${ext}`,
    title,
    artist: credit,
    artists,
    artistIds: artists.map((name) => slug(name, 'unknown-artist')),
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
  await fs.rm(OUT.legacy, { recursive: true, force: true });
  let artistDirs;
  try {
    artistDirs = await fs.readdir(OUT.artists, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const dir of artistDirs) {
    if (!dir.isDirectory()) continue;
    const abs = path.join(OUT.artists, dir.name);
    for (const name of await fs.readdir(abs)) {
      if (keep.has(`songs/artists/${dir.name}/${name}`)) continue;
      await fs.rm(path.join(abs, name), { force: true });
      removed += 1;
    }
    // An artist whose last track was removed should not leave an empty folder.
    if ((await fs.readdir(abs)).length === 0) await fs.rm(abs, { recursive: true, force: true });
  }
  return removed;
}

export async function runPipeline(options = {}) {
  const flags = {
    strict: false,
    clean: false,
    refresh: false,
    config: path.join(root, 'content', 'playlists.json'),
    ...options,
  };
  const release = flags.quiet ? captureLog() : null;
  try {
    const summary = await run(flags);
    return { ...summary, log: release ? release() : [] };
  } catch (error) {
    if (release) error.log = release();
    throw error;
  }
}

async function run(flags) {

  if (flags.clean) {
    log.step('Clearing cache and generated media');
    await Promise.all([
      fs.rm(path.join(root, '.cache'), { recursive: true, force: true }),
      fs.rm(OUT.songs, { recursive: true, force: true }),
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
  const taken = new Set();
  const built = await pool(entries, config.options.concurrency, (entry) =>
    buildTrack(entry, { options: config.options, refresh: flags.refresh, capabilities, taken }),
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

  // One entry per person credited, in the order they first appear in the library.
  const artistIndex = new Map();
  for (const track of tracks) {
    track.artists.forEach((name, i) => {
      const id = track.artistIds[i];
      let artist = artistIndex.get(id);
      if (!artist) {
        artist = { id, name, hue: hueOfString(id), trackIds: [], albums: [], duration: 0 };
        artistIndex.set(id, artist);
      }
      // Files live under the first-credited artist, so only they own a folder.
      if (i === 0) artist.folder = `songs/artists/${id}`;
      artist.trackIds.push(track.id);
      artist.duration += track.duration || 0;
      if (!artist.art && track.art) artist.art = track.art;
      if (track.album && !artist.albums.includes(track.album)) artist.albums.push(track.album);
    });
  }
  const artists = [...artistIndex.values()]
    .map((artist) => ({ ...artist, duration: Math.round(artist.duration) }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
    artists,
    tracks,
  };
  await fs.mkdir(path.dirname(OUT.library), { recursive: true });
  await fs.writeFile(OUT.library, `${JSON.stringify(library, null, 2)}\n`);

  const totalBytes = tracks.reduce((sum, t) => sum + t.bytes, 0);
  const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  log.step('Library written');
  log.detail(
    `${tracks.length} tracks - ${artists.length} artists - ${Math.round(totalSeconds / 60)} min - ${formatBytes(totalBytes)}` +
      (removed ? ` - pruned ${removed} stale file(s)` : ''),
  );

  if (failed > 0) {
    log.warn(`${failed} source(s) could not be fetched; the build continues without them`);
  }

  return {
    trackCount: tracks.length,
    artistCount: artists.length,
    playlistCount: playlists.length,
    failed,
    bytes: totalBytes,
  };
}
