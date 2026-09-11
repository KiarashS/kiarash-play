import type { Track } from '../types';
import { href } from '../lib/router';

/**
 * The credit line, with each named artist linking to their page.
 *
 * Plain hash links, so this works anywhere without threading a navigate callback
 * through the tree. When a track has one artist the whole line is the link;
 * with several, only the names are, and the rest of the credit stays as written.
 */
export function ArtistLinks({ track, className }: { track: Track; className?: string }) {
  const names = track.artists ?? [];

  if (names.length === 0) {
    return <span className={className}>{track.artist}</span>;
  }

  if (names.length === 1 && names[0] === track.artist) {
    return (
      <a
        className={`${className ?? ''} artist-link`.trim()}
        href={href({ view: 'artist', id: track.artistIds[0] })}
        onClick={(event) => event.stopPropagation()}
      >
        {track.artist}
      </a>
    );
  }

  return (
    <span className={className}>
      {names.map((name, index) => (
        <span key={track.artistIds[index]}>
          {index > 0 && <span aria-hidden="true">, </span>}
          <a
            className="artist-link"
            href={href({ view: 'artist', id: track.artistIds[index] })}
            onClick={(event) => event.stopPropagation()}
          >
            {name}
          </a>
        </span>
      ))}
    </span>
  );
}
