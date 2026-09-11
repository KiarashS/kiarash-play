#!/usr/bin/env node
/**
 * Command line over the media pipeline.
 *
 * Reads content/playlists.json, downloads every track URL, reads its tags,
 * optionally re-encodes and waveform-samples it, and writes public/library.json
 * plus the audio under public/songs/artists/ that the player streams.
 *
 * Downloads are cached in .cache/ and keyed by a hash of the URL, so re-running
 * this is cheap and CI only pays for tracks that were added or changed.
 *
 *   node scripts/fetch-media.mjs [--strict] [--clean] [--refresh] [--config <path>]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError } from './lib/config.mjs';
import { runPipeline } from './lib/pipeline.mjs';
import { log } from './lib/log.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');


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

runPipeline(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error();
  log.fail(error instanceof ConfigError ? error.message : error.stack || String(error));
  process.exit(1);
});
