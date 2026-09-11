import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { keyOf, sleep } from './util.mjs';

const EXT_BY_TYPE = new Map([
  ['audio/mpeg', '.mp3'],
  ['audio/mp3', '.mp3'],
  ['audio/mp4', '.m4a'],
  ['audio/x-m4a', '.m4a'],
  ['audio/aac', '.aac'],
  ['audio/ogg', '.ogg'],
  ['application/ogg', '.ogg'],
  ['audio/opus', '.opus'],
  ['audio/webm', '.weba'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['audio/wave', '.wav'],
  ['audio/flac', '.flac'],
  ['audio/x-flac', '.flac'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['text/plain', '.txt'],
]);

const KNOWN_EXTS = new Set([
  '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.weba', '.webm',
  '.wav', '.flac', '.aiff', '.aif', '.wma', '.jpg', '.jpeg', '.png',
  '.webp', '.avif', '.gif', '.lrc', '.txt',
]);

function extFromUrl(url) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const ext = path.extname(name).toLowerCase();
    return KNOWN_EXTS.has(ext) ? ext : '';
  } catch {
    return '';
  }
}

function extFromContentType(contentType) {
  const base = String(contentType || '').split(';')[0].trim().toLowerCase();
  return EXT_BY_TYPE.get(base) || '';
}

export class DownloadError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.status = status;
  }
}

/** 4xx responses will not get better on a retry; 408/429 and 5xx might. */
function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function findCached(dir, key) {
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  const hit = names.find((name) => name.startsWith(`${key}.`) && !name.endsWith('.part'));
  return hit ? path.join(dir, hit) : null;
}

/**
 * Fetch `url` into `dir`, named by a hash of the URL so repeat builds are free.
 * Returns the path on disk plus whether the network was touched.
 */
export async function download(url, { dir, retries = 3, timeout = 120, refresh = false, accept } = {}) {
  await fs.mkdir(dir, { recursive: true });
  const key = keyOf(url);

  if (!refresh) {
    const cached = await findCached(dir, key);
    if (cached) {
      const stat = await fs.stat(cached);
      if (stat.size > 0) return { file: cached, bytes: stat.size, fromCache: true };
      await fs.rm(cached, { force: true });
    }
  }

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout * 1000);
    const partial = path.join(dir, `${key}.part`);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          // Some CDNs (Wikimedia among them) reject requests without a User-Agent.
          'user-agent': 'kiarash-play build script (+https://github.com/KiarashS/kiarash-play)',
          ...(accept ? { accept } : {}),
        },
      });

      if (!response.ok) {
        const error = new DownloadError(`HTTP ${response.status} ${response.statusText}`, {
          status: response.status,
        });
        if (!isRetryableStatus(response.status)) throw error;
        lastError = error;
        throw error;
      }

      if (!response.body) throw new DownloadError('empty response body');

      await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
      const stat = await fs.stat(partial);
      if (stat.size === 0) throw new DownloadError('downloaded 0 bytes');

      const ext = extFromUrl(url) || extFromContentType(response.headers.get('content-type')) || '.bin';
      const target = path.join(dir, `${key}${ext}`);
      await fs.rename(partial, target);
      return {
        file: target,
        bytes: stat.size,
        fromCache: false,
        contentType: response.headers.get('content-type') || undefined,
      };
    } catch (error) {
      lastError = error;
      if (await exists(partial)) await fs.rm(partial, { force: true });
      const fatal = error instanceof DownloadError && error.status && !isRetryableStatus(error.status);
      if (fatal || attempt === retries) break;
      await sleep(2 ** attempt * 500);
    } finally {
      clearTimeout(timer);
    }
  }

  const reason = lastError?.name === 'AbortError' ? `timed out after ${timeout}s` : lastError?.message;
  throw new DownloadError(reason || 'download failed');
}
