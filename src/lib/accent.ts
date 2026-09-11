export interface Accent {
  h: number;
  s: number;
  l: number;
}

function rgbToHsl(r: number, g: number, b: number): Accent {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Average hue of an image, weighted by saturation so a mostly grey cover with one
 * coloured detail still reads as that colour. Hues are averaged on the circle,
 * otherwise red (near 0 and near 360) averages to cyan.
 */
export async function accentFromImage(src: string): Promise<Accent | null> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null;
  }

  const size = 36;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    // Tainted canvas: the artwork came from another origin.
    return null;
  }

  let x = 0;
  let y = 0;
  let weight = 0;
  let satSum = 0;
  let lightSum = 0;
  let samples = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const { h, s, l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l < 8 || l > 94) continue;
    const w = (s / 100) ** 2;
    const radians = (h * Math.PI) / 180;
    x += Math.cos(radians) * w;
    y += Math.sin(radians) * w;
    weight += w;
    satSum += s;
    lightSum += l;
    samples += 1;
  }

  if (samples === 0 || weight < 0.0001) return null;

  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const saturation = Math.min(92, Math.max(48, satSum / samples + 14));
  const lightness = Math.min(72, Math.max(52, lightSum / samples * 0.6 + 30));
  return { h: Math.round(hue), s: Math.round(saturation), l: Math.round(lightness) };
}

export function applyAccent(accent: Accent): void {
  const root = document.documentElement;
  root.style.setProperty('--accent-h', String(accent.h));
  root.style.setProperty('--accent-s', `${accent.s}%`);
  root.style.setProperty('--accent-l', `${accent.l}%`);
  const theme = root.getAttribute('data-theme');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#eceaf4' : '#06060b');
}
