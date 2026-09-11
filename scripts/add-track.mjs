#!/usr/bin/env node
/**
 * Add one track URL to one or more playlists and refresh the library.
 * The uploader in the player calls the same code over HTTP.
 *
 *   node scripts/add-track.mjs <url> --playlist "Late Night Piano" [--playlist Focus]
 *        [--title T] [--artist "A, performed by B"] [--artists "A, B"]
 *        [--album X] [--cover URL] [--lyrics URL] [--accent "#7c6cff"]
 *
 * A --playlist that matches no existing id or title creates a playlist with that title.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestError } from './lib/manifest.mjs';
import { addTrack } from './lib/studio.mjs';
import { log } from './lib/log.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const CONFIG = path.join(root, 'content', 'playlists.json');

function parseArgs(argv) {
  const flags = { playlists: [], track: {}, config: CONFIG };
  const single = ['title', 'artist', 'artists', 'album', 'year', 'cover', 'lyrics'];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (flags.track.url) throw new ManifestError(`unexpected second URL "${arg}"`);
      flags.track.url = arg;
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    const value = () => inline ?? argv[++i] ?? '';
    if (name === 'playlist') flags.playlists.push(value());
    else if (name === 'accent') flags.accent = value();
    else if (name === 'config') flags.config = path.resolve(value());
    else if (single.includes(name)) flags.track[name] = value();
    else throw new ManifestError(`unknown option "--${name}"`);
  }

  if (!flags.track.url) throw new ManifestError('give the track URL as the first argument');
  if (flags.playlists.length === 0) throw new ManifestError('pass at least one --playlist');
  return flags;
}

try {
  const flags = parseArgs(process.argv.slice(2));
  const result = await addTrack({
    configPath: flags.config,
    track: flags.track,
    playlists: flags.playlists,
    accent: flags.accent,
    quiet: false,
  });
  console.log();
  for (const playlist of result.created) log.ok(`created playlist "${playlist.title}"`);
  for (const id of result.added) log.ok(`added to ${id}`);
  for (const id of result.updated) log.skip(`already in ${id}, entry updated`);
  log.detail(`filed as public/${result.track.src}`);
  log.detail(
    `library now has ${result.pipeline.trackCount} tracks across ${result.pipeline.artistCount} artists`,
  );
} catch (error) {
  console.error();
  log.fail(error instanceof ManifestError ? error.message : error.stack || String(error));
  process.exit(1);
}
