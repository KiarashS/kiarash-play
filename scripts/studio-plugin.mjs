/**
 * The uploader's back end.
 *
 * A Vite plugin that mounts a tiny API on the dev and preview servers so the
 * "Add music" form in the player can do what `node scripts/add-track.mjs` does:
 * write the track into content/playlists.json, then run the media pipeline so
 * the file lands under public/songs/artists/<artist>/ and library.json is rebuilt.
 *
 * It never ships. `vite build` produces static files with no API, and the form
 * notices that and offers a manifest snippet to paste instead.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeManifest, ManifestError, readManifest } from './lib/manifest.mjs';
import { addTrack, removeTrack } from './lib/studio.mjs';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const CONFIG = path.join(root, 'content', 'playlists.json');
const BODY_LIMIT = 64 * 1024;

/** The API writes to the repo and fetches arbitrary URLs, so it answers this machine only. */
function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? '';
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address === '::ffff:127.0.0.1' ||
    address.startsWith('127.')
  );
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new ManifestError('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new ManifestError('request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function studioPlugin({ configPath = CONFIG } = {}) {
  // One write at a time: two uploads racing would both read the same manifest
  // and the second would clobber the first.
  let busy = null;

  const withLock = async (work) => {
    while (busy) await busy.catch(() => {});
    let release;
    busy = new Promise((resolve) => {
      release = resolve;
    });
    try {
      return await work();
    } finally {
      release();
      busy = null;
    }
  };

  const handle = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/__studio/')) return false;

    if (!isLoopback(req)) {
      send(res, 403, { error: 'The uploader only accepts requests from this machine.' });
      return true;
    }

    try {
      if (url.pathname === '/__studio/state' && req.method === 'GET') {
        const manifest = await readManifest(configPath);
        send(res, 200, {
          enabled: true,
          configPath: path.relative(root, configPath),
          playlists: describeManifest(manifest),
        });
        return true;
      }

      if (url.pathname === '/__studio/add' && req.method === 'POST') {
        const body = await readBody(req);
        const result = await withLock(() =>
          addTrack({
            configPath,
            track: body,
            playlists: body.playlists ?? [],
            accent: body.accent,
          }),
        );
        send(res, 200, { ok: true, ...result });
        return true;
      }

      if (url.pathname === '/__studio/remove' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.url) throw new ManifestError('which track URL should be removed?');
        const result = await withLock(() =>
          removeTrack({ configPath, url: body.url, playlist: body.playlist }),
        );
        send(res, 200, { ok: true, ...result });
        return true;
      }

      send(res, 404, { error: 'unknown studio endpoint' });
      return true;
    } catch (error) {
      send(res, error instanceof ManifestError ? 400 : 500, {
        error: error instanceof ManifestError ? error.message : String(error?.message ?? error),
      });
      return true;
    }
  };

  const middleware = (req, res, next) => {
    handle(req, res).then((handled) => {
      if (!handled) next();
    }, next);
  };

  return {
    name: 'kiarash-play-studio',
    apply: (_config, env) => env.command === 'serve',
    // Note the braces: returning middlewares.use()'s value would hand Vite the
    // connect app as a "run after internal middlewares" hook, and it would call it.
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
