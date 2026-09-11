import type { CSSProperties } from 'react';
import type { Track } from '../types';
import { assetUrl, hueFor } from '../lib/library';

interface CoverProps {
  /** Base-relative path from library.json, or an absolute URL from the manifest. */
  art?: string;
  /** Anything stable; decides the gradient when there is no artwork. */
  seed: string;
  label: string;
  /** Overrides the gradient hue; falls back to a hash of `seed`. */
  hue?: number;
  className?: string;
  style?: CSSProperties;
}

function initials(label: string): string {
  const words = label.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function resolve(art: string): string {
  return /^https?:\/\//i.test(art) ? art : assetUrl(art);
}

export function Cover({ art, seed, label, hue, className, style }: CoverProps) {
  return (
    <div
      className={`cover${className ? ` ${className}` : ''}`}
      style={{ ...style, ['--cover-h' as string]: hue ?? hueFor(seed) }}
    >
      {art ? (
        <img src={resolve(art)} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="cover__glyph" aria-hidden="true">
          {initials(label)}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Playlist covers: a 2x2 grid once four tracks have artwork, otherwise one tile. */
export function MosaicCover({
  tracks,
  label,
  seed,
  hue,
}: {
  tracks: Track[];
  label: string;
  seed: string;
  hue?: number;
}) {
  const withArt = tracks.filter((track) => track.art).slice(0, 4);
  if (withArt.length < 4) {
    return <Cover art={withArt[0]?.art} seed={seed} label={label} hue={hue} />;
  }
  return (
    <div className="cover cover--mosaic">
      {withArt.map((track) => (
        <img key={track.id} src={resolve(track.art as string)} alt="" loading="lazy" decoding="async" />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
