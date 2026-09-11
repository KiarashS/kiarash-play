import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';

/** Formats every current browser agrees on. Everything else is a candidate for re-encoding. */
const WEB_SAFE = new Set(['.mp3', '.m4a', '.aac', '.mp4']);

const ENCODERS = {
  mp3: { ext: '.mp3', args: ['-c:a', 'libmp3lame', '-q:a', '2'] },
  m4a: { ext: '.m4a', args: ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'] },
};

let ffmpegProbe;

function run(command, args, { capture = false, maxBuffer = 256 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', capture ? 'pipe' : 'ignore', 'pipe'] });
    const out = [];
    const err = [];
    let size = 0;

    if (capture) {
      child.stdout.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBuffer) {
          child.kill('SIGKILL');
          reject(new Error(`${command} produced more than ${maxBuffer} bytes`));
          return;
        }
        out.push(chunk);
      });
    }
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${command} exited ${code}: ${Buffer.concat(err).toString().trim().slice(-400)}`));
    });
  });
}

/** Cached one-shot check so we only pay for the probe once per build. */
export async function hasFfmpeg() {
  if (ffmpegProbe === undefined) {
    ffmpegProbe = run('ffmpeg', ['-version'])
      .then(() => true)
      .catch(() => false);
  }
  return ffmpegProbe;
}

export function needsTranscode(file, mode) {
  if (mode === 'off') return false;
  const ext = path.extname(file).toLowerCase();
  if (mode === 'auto') return !WEB_SAFE.has(ext);
  return ENCODERS[mode].ext !== ext;
}

export async function transcode(source, targetDir, key, mode) {
  const format = mode === 'auto' ? 'mp3' : mode;
  const encoder = ENCODERS[format];
  await fs.mkdir(targetDir, { recursive: true });
  const target = path.join(targetDir, `${key}${encoder.ext}`);

  try {
    const stat = await fs.stat(target);
    if (stat.size > 0) return { file: target, fromCache: true };
  } catch {
    // not encoded yet
  }

  const partial = `${target}.part${encoder.ext}`;
  await run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vn', ...encoder.args, partial]);
  await fs.rename(partial, target);
  return { file: target, fromCache: false };
}

/**
 * Decode to low-rate mono PCM and reduce it to `buckets` peak values in 0..1.
 * The seek bar draws these; without ffmpeg the UI falls back to a plain bar.
 */
export async function peaks(file, buckets) {
  const raw = await run('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '4000', '-f', 's16le', '-'], {
    capture: true,
  });
  const samples = raw.length >> 1;
  if (samples < buckets) return null;

  const out = new Array(buckets).fill(0);
  const per = samples / buckets;
  for (let i = 0; i < samples; i += 1) {
    const bucket = Math.min(buckets - 1, Math.floor(i / per));
    const value = Math.abs(raw.readInt16LE(i * 2));
    if (value > out[bucket]) out[bucket] = value;
  }

  const loudest = Math.max(...out, 1);
  // Square-root shaping keeps quiet passages visible instead of a flat line.
  return out.map((v) => Math.round(Math.sqrt(v / loudest) * 100) / 100);
}

export async function readTags(file) {
  try {
    const { common, format } = await parseFile(file, { duration: true });
    return {
      title: common.title?.trim() || undefined,
      artist: (common.artist || common.albumartist)?.trim() || undefined,
      album: common.album?.trim() || undefined,
      year: common.year || undefined,
      genre: common.genre?.[0]?.trim() || undefined,
      trackNumber: common.track?.no || undefined,
      duration: Number.isFinite(format.duration) ? Math.round(format.duration * 10) / 10 : undefined,
      bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : undefined,
      picture: common.picture?.[0]
        ? { data: Buffer.from(common.picture[0].data), format: common.picture[0].format }
        : undefined,
    };
  } catch {
    return {};
  }
}

export function imageExtFor(mime) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  return map[String(mime).toLowerCase()] || '.jpg';
}
