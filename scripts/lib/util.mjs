import { createHash } from 'node:crypto';
import path from 'node:path';

/** Stable short id for a source URL. Used for cache keys and output filenames. */
export function keyOf(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

export function slug(value, fallback = 'untitled') {
  const out = String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || fallback;
}

/** Turn ".../Kevin_MacLeod_-_Erik_Satie_Gymnopedie_No_1.ogg" into something readable. */
export function titleFromUrl(url) {
  let name;
  try {
    name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    name = path.basename(url);
  }
  return (
    name
      .replace(/\.[a-z0-9]{1,5}$/i, '')
      .replace(/[_+]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim() || 'Untitled'
  );
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '?';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)}${units[i]}`;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Run `worker` over `items` with at most `limit` in flight, preserving input order. */
export async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const width = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: width }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Hue of a #rrggbb / #rgb colour, or null when it is not a hex colour. */
export function hueOfHex(hex) {
  const value = String(hex || '').trim().replace(/^#/, '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return Math.round(h * 360);
}

/** Stable pseudo-random hue in 0..359 for anything without a colour of its own. */
export function hueOfString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % 360;
}
