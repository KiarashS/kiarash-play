export interface LyricLine {
  time: number;
  text: string;
}

export interface Track {
  id: string;
  /** The URL this track was fetched from at build time. */
  source: string;
  /** Path relative to the site base, e.g. "media/audio/abc.mp3". */
  src: string;
  title: string;
  artist: string;
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
  /** Cover copied into public/media, borrowed from the first track that has art. */
  cover?: string;
  /** Cover left as a remote URL by the manifest. */
  coverUrl?: string;
  trackIds: string[];
  duration: number;
}

export interface Library {
  generatedAt: string;
  site: { title: string; tagline: string };
  playlists: Playlist[];
  tracks: Track[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueOrigin {
  kind: 'playlist' | 'liked' | 'recent' | 'search' | 'all' | 'queue';
  id?: string;
  title: string;
}
