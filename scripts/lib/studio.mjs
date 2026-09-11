/**
 * Adding and removing tracks, shared by the `npm run add` command and the
 * uploader's dev API so both behave identically.
 *
 * An add is all-or-nothing: if the file cannot be fetched, the manifest is put
 * back the way it was rather than left holding an entry that will never resolve.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addTrackToManifest,
  ManifestError,
  readManifest,
  removeTrackFromManifest,
  writeManifest,
} from './manifest.mjs';
import { runPipeline } from './pipeline.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
const LIBRARY = path.join(root, 'public', 'library.json');

async function publishedTrack(url) {
  try {
    const library = JSON.parse(await fs.readFile(LIBRARY, 'utf8'));
    return library.tracks.find((track) => track.source === url) ?? null;
  } catch {
    return null;
  }
}

export async function addTrack({ configPath, track, playlists, accent, quiet = true }) {
  const before = await fs.readFile(configPath, 'utf8');
  const manifest = JSON.parse(before);
  const written = addTrackToManifest(
    manifest,
    track,
    playlists.map((target) => ({ target, accent })),
  );
  await writeManifest(configPath, manifest);

  let pipeline;
  try {
    pipeline = await runPipeline({ config: configPath, quiet });
  } catch (error) {
    await fs.writeFile(configPath, before);
    throw new ManifestError(`could not rebuild the library: ${error.message}`);
  }

  const published = await publishedTrack(written.track.url);
  if (!published) {
    await fs.writeFile(configPath, before);
    await runPipeline({ config: configPath, quiet: true });
    const reason = (pipeline.log ?? []).find((line) => line.startsWith('failed '));
    throw new ManifestError(
      reason
        ? `that URL could not be added - ${reason.replace(/^failed /, '')}`
        : 'that URL could not be added; nothing was changed',
    );
  }

  return { ...written, track: published, pipeline };
}

export async function removeTrack({ configPath, url, playlist, quiet = true }) {
  const manifest = await readManifest(configPath);
  const removed = removeTrackFromManifest(manifest, url, playlist);
  if (removed.length === 0) throw new ManifestError('that URL is not in the manifest');
  await writeManifest(configPath, manifest);
  const pipeline = await runPipeline({ config: configPath, quiet });
  return { removed, pipeline };
}
