export interface LyricLine {
  time: number;
  text: string;
}

export interface Track {
  id: string;
  /** The URL this track was fetched from at build time. */
  source: string;
  /** Path relative to the site base, e.g. "songs/artists/erik-satie/gymnopedie-no-1.mp3". */
  src: string;
  title: string;
  /** The credit line shown under the title. */
  artist: string;
  /** The people who get their own page; the first one owns the file's folder. */
  artists: string[];
  artistIds: string[];
  album?: string;
  year?: number;
  genre?: string;
  /** Seconds, read from the file's tags at build time. */
  duration: number;
  bytes: number;
  bitrate?: number;
  art?: string;
  /** Hue stamped at build time from the playlist this track first appeared in. */
  hue?: number;
  /** Peak values in 0..1, one per waveform bucket. Null when ffmpeg was unavailable. */
  waveform: number[] | null;
  lyrics?: LyricLine[];
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  accent?: string;
  /** Hue derived from `accent`, or from the playlist id when none was given. */
  hue?: number;
  /** Cover borrowed from the first track in the playlist that has art. */
  cover?: string;
  /** Cover left as a remote URL by the manifest. */
  coverUrl?: string;
  trackIds: string[];
  duration: number;
}

export interface Artist {
  id: string;
  name: string;
  hue: number;
  /** Set only for artists credited first on a track, who own the folder on disk. */
  folder?: string;
  trackIds: string[];
  albums: string[];
  duration: number;
  art?: string;
}

export interface Library {
  generatedAt: string;
  site: { title: string; tagline: string };
  playlists: Playlist[];
  artists: Artist[];
  tracks: Track[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueOrigin {
  kind: 'playlist' | 'artist' | 'liked' | 'recent' | 'search' | 'all' | 'queue';
  id?: string;
  title: string;
}
