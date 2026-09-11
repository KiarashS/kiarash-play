import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { QueueOrigin, RepeatMode, Track } from '../types';
import { assetUrl } from '../lib/library';
import { read, write } from '../lib/storage';

interface PlayerState {
  /** Track ids in the order they will play. */
  queue: string[];
  /** The same ids in their pre-shuffle order, so shuffle can be undone. */
  base: string[];
  index: number;
  origin: QueueOrigin | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  muted: boolean;
}

type Action =
  | { type: 'play-context'; ids: string[]; startAt: number; origin: QueueOrigin }
  | { type: 'jump'; index: number }
  | { type: 'advance'; delta: number; auto?: boolean }
  | { type: 'set-playing'; value: boolean }
  | { type: 'toggle-shuffle' }
  | { type: 'cycle-repeat' }
  | { type: 'set-volume'; value: number }
  | { type: 'toggle-mute' }
  | { type: 'enqueue'; ids: string[]; next: boolean }
  | { type: 'remove'; index: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'clear-upcoming' }
  | { type: 'restore'; state: Partial<PlayerState> };

const STORE_KEY = 'session';

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Shuffle everything except the track playing right now, which stays at the front. */
function shuffleAround(ids: string[], currentIndex: number): { queue: string[]; index: number } {
  if (currentIndex < 0) return { queue: shuffled(ids), index: ids.length ? 0 : -1 };
  const current = ids[currentIndex];
  const rest = ids.filter((_, i) => i !== currentIndex);
  return { queue: [current, ...shuffled(rest)], index: 0 };
}

const initialState: PlayerState = {
  queue: [],
  base: [],
  index: -1,
  origin: null,
  isPlaying: false,
  shuffle: false,
  repeat: 'off',
  volume: 0.8,
  muted: false,
};

function reducer(state: PlayerState, action: Action): PlayerState {
  switch (action.type) {
    case 'play-context': {
      const base = action.ids;
      if (base.length === 0) return state;
      const startAt = Math.max(0, Math.min(action.startAt, base.length - 1));
      if (state.shuffle) {
        const { queue, index } = shuffleAround(base, startAt);
        return { ...state, base, queue, index, origin: action.origin, isPlaying: true };
      }
      return { ...state, base, queue: base, index: startAt, origin: action.origin, isPlaying: true };
    }

    case 'jump': {
      if (action.index < 0 || action.index >= state.queue.length) return state;
      return { ...state, index: action.index, isPlaying: true };
    }

    case 'advance': {
      if (state.queue.length === 0) return state;
      const next = state.index + action.delta;
      if (next >= state.queue.length) {
        if (state.repeat === 'all') return { ...state, index: 0, isPlaying: true };
        // Reaching the end on autoplay stops; pressing "next" manually also stops.
        return { ...state, index: state.queue.length - 1, isPlaying: false };
      }
      if (next < 0) return { ...state, index: 0, isPlaying: true };
      return { ...state, index: next, isPlaying: true };
    }

    case 'set-playing':
      return state.index < 0 ? state : { ...state, isPlaying: action.value };

    case 'toggle-shuffle': {
      if (state.shuffle) {
        const currentId = state.queue[state.index];
        const index = state.base.indexOf(currentId);
        return { ...state, shuffle: false, queue: state.base, index: index === -1 ? 0 : index };
      }
      const currentId = state.queue[state.index];
      const baseIndex = state.base.indexOf(currentId);
      const { queue, index } = shuffleAround(state.base, baseIndex);
      return { ...state, shuffle: true, queue, index };
    }

    case 'cycle-repeat': {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const next = order[(order.indexOf(state.repeat) + 1) % order.length];
      return { ...state, repeat: next };
    }

    case 'set-volume':
      return { ...state, volume: Math.max(0, Math.min(1, action.value)), muted: false };

    case 'toggle-mute':
      return { ...state, muted: !state.muted };

    case 'enqueue': {
      const ids = action.ids.filter(Boolean);
      if (ids.length === 0) return state;
      if (state.index < 0) {
        return { ...state, queue: ids, base: ids, index: 0, isPlaying: true, origin: { kind: 'queue', title: 'Queue' } };
      }
      const at = action.next ? state.index + 1 : state.queue.length;
      const queue = [...state.queue.slice(0, at), ...ids, ...state.queue.slice(at)];
      return { ...state, queue, base: state.shuffle ? [...state.base, ...ids] : queue };
    }

    case 'remove': {
      if (action.index < 0 || action.index >= state.queue.length || action.index === state.index) return state;
      const removed = state.queue[action.index];
      const queue = state.queue.filter((_, i) => i !== action.index);
      const index = action.index < state.index ? state.index - 1 : state.index;
      const base = state.base.filter((id, i) => (state.shuffle ? id !== removed : i !== action.index));
      return { ...state, queue, base, index };
    }

    case 'move': {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return state;
      const queue = state.queue.slice();
      const [moved] = queue.splice(from, 1);
      queue.splice(to, 0, moved);
      const currentId = state.queue[state.index];
      return { ...state, queue, index: queue.indexOf(currentId) };
    }

    case 'clear-upcoming':
      return { ...state, queue: state.queue.slice(0, state.index + 1), base: state.base.slice(0, state.index + 1) };

    case 'restore':
      return { ...state, ...action.state, isPlaying: false };

    default:
      return state;
  }
}

export interface SleepTimer {
  /** Epoch ms when playback stops, or "track" to stop when the current track ends. */
  until: number | 'track';
  label: string;
}

interface PlayerApi extends PlayerState {
  current: Track | null;
  upcoming: { track: Track; index: number }[];
  playContext: (ids: string[], startAt: number, origin: QueueOrigin) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  jump: (index: number) => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  enqueue: (ids: string[], next?: boolean) => void;
  removeAt: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  clearUpcoming: () => void;
  sleepTimer: SleepTimer | null;
  setSleepTimer: (timer: SleepTimer | null) => void;
  analyser: AnalyserNode | null;
  error: string | null;
}

const PlayerContext = createContext<PlayerApi | null>(null);
/** Time updates are split into their own context so a 60fps seek bar does not re-render the app. */
const ProgressContext = createContext<{ time: number; duration: number; buffered: number }>({
  time: 0,
  duration: 0,
  buffered: 0,
});

interface Props {
  tracks: Map<string, Track>;
  onPlayed?: (id: string) => void;
  children: ReactNode;
}

export function PlayerProvider({ tracks, onPlayed, children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    ...read<Partial<PlayerState>>(STORE_KEY, {}),
    isPlaying: false,
  }));
  const [progress, setProgress] = useState({ time: 0, duration: 0, buffered: 0 });
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [sleepTimer, setSleepTimer] = useState<SleepTimer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const graphRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const resumeAtRef = useRef<number>(read<number>('resume-at', 0));
  const stateRef = useRef(state);
  stateRef.current = state;

  if (audioRef.current === null && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;
  }

  const currentId = state.index >= 0 ? state.queue[state.index] : undefined;
  const current = currentId ? tracks.get(currentId) ?? null : null;

  /** The analyser needs an AudioContext, which browsers only let us start from a gesture. */
  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || graphRef.current) return graphRef.current;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audio);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.78;
      const gain = ctx.createGain();
      source.connect(node);
      node.connect(gain);
      gain.connect(ctx.destination);
      graphRef.current = { ctx, gain };
      setAnalyser(node);
      return graphRef.current;
    } catch {
      // Safari throws if a source was already created for this element; play still works.
      return null;
    }
  }, []);

  // Load the selected track. Position is restored once, on the first track of a session.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    const url = assetUrl(current.src);
    if (audio.src !== new URL(url, window.location.href).href) {
      audio.src = url;
      audio.load();
      const resumeAt = resumeAtRef.current;
      resumeAtRef.current = 0;
      if (resumeAt > 0 && resumeAt < current.duration - 5) {
        const apply = () => {
          audio.currentTime = resumeAt;
          audio.removeEventListener('loadedmetadata', apply);
        };
        audio.addEventListener('loadedmetadata', apply);
      }
      setError(null);
      onPlayed?.(current.id);
      // Ask the service worker for a full, non-Range copy so the track works offline.
      navigator.serviceWorker?.controller?.postMessage({
        type: 'cache-audio',
        url: new URL(url, window.location.href).href,
      });
    }
  }, [current, onPlayed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.isPlaying) {
      const graph = ensureGraph();
      if (graph?.ctx.state === 'suspended') void graph.ctx.resume();
      // Pressing play on a track that ran to the end should start it over,
      // not replay the final millisecond and stop again.
      if (audio.duration && audio.currentTime >= audio.duration - 0.25) audio.currentTime = 0;
      const attempt = audio.play();
      if (attempt) {
        attempt.catch((reason: DOMException) => {
          if (reason.name === 'AbortError') return;
          dispatch({ type: 'set-playing', value: false });
          setError(
            reason.name === 'NotAllowedError'
              ? 'The browser blocked playback. Press play again.'
              : `This track could not be played (${reason.name}).`,
          );
        });
      }
    } else {
      audio.pause();
    }
  }, [state.isPlaying, currentId, ensureGraph]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.volume;
    audio.muted = state.muted;
  }, [state.volume, state.muted]);

  // Audio element events: time, buffering, end-of-track, failures.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let frame = 0;
    const sync = () => {
      const buffered = audio.buffered.length > 0 ? audio.buffered.end(audio.buffered.length - 1) : 0;
      setProgress((prev) => {
        const time = audio.currentTime;
        const duration = Number.isFinite(audio.duration) ? audio.duration : current?.duration ?? 0;
        if (Math.abs(prev.time - time) < 0.05 && prev.duration === duration && prev.buffered === buffered) {
          return prev;
        }
        return { time, duration, buffered };
      });
    };

    const loop = () => {
      sync();
      frame = requestAnimationFrame(loop);
    };

    const onPlay = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    const onPause = () => {
      cancelAnimationFrame(frame);
      sync();
    };
    const onEnded = () => {
      const now = stateRef.current;
      if (sleepTimer?.until === 'track') {
        setSleepTimer(null);
        dispatch({ type: 'set-playing', value: false });
        return;
      }
      if (now.repeat === 'one') {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      dispatch({ type: 'advance', delta: 1, auto: true });
    };
    const onError = () => {
      setError(`"${current?.title ?? 'This track'}" could not be decoded in this browser.`);
      dispatch({ type: 'set-playing', value: false });
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('loadedmetadata', sync);
    audio.addEventListener('progress', sync);
    if (!audio.paused) onPlay();

    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('loadedmetadata', sync);
      audio.removeEventListener('progress', sync);
    };
  }, [current, sleepTimer]);

  // Sleep timer: a wall-clock deadline survives tab throttling better than a long setTimeout.
  useEffect(() => {
    if (!sleepTimer) return;
    const deadline = sleepTimer.until;
    if (deadline === 'track') return;
    const tick = window.setInterval(() => {
      if (Date.now() >= deadline) {
        dispatch({ type: 'set-playing', value: false });
        setSleepTimer(null);
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [sleepTimer]);

  // Persist preferences and where we left off.
  useEffect(() => {
    write(STORE_KEY, {
      queue: state.queue,
      base: state.base,
      index: state.index,
      origin: state.origin,
      shuffle: state.shuffle,
      repeat: state.repeat,
      volume: state.volume,
      muted: state.muted,
    });
  }, [state]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio && !audio.paused) write('resume-at', audio.currentTime);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, max));
    setProgress((prev) => ({ ...prev, time: audio.currentTime }));
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (audio) seek(audio.currentTime + delta);
    },
    [seek],
  );

  // OS media keys, lock screen art, and the browser's own media controls.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    const art = current.art ? [{ src: assetUrl(current.art), sizes: '512x512' }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album ?? state.origin?.title ?? '',
      artwork: art,
    });
    navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => dispatch({ type: 'set-playing', value: true })],
      ['pause', () => dispatch({ type: 'set-playing', value: false })],
      ['previoustrack', () => dispatch({ type: 'advance', delta: -1 })],
      ['nexttrack', () => dispatch({ type: 'advance', delta: 1 })],
      ['seekbackward', () => seekBy(-10)],
      ['seekforward', () => seekBy(10)],
      ['seekto', (details) => details.seekTime !== undefined && seek(details.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Not every action is supported everywhere.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, [current, state.isPlaying, state.origin, seek, seekBy]);

  const upcoming = useMemo(() => {
    if (state.index < 0) return [];
    return state.queue
      .slice(state.index + 1)
      .map((id, offset) => ({ track: tracks.get(id), index: state.index + 1 + offset }))
      .filter((entry): entry is { track: Track; index: number } => Boolean(entry.track));
  }, [state.queue, state.index, tracks]);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      current,
      upcoming,
      analyser,
      error,
      sleepTimer,
      setSleepTimer,
      playContext: (ids, startAt, origin) => dispatch({ type: 'play-context', ids, startAt, origin }),
      toggle: () => dispatch({ type: 'set-playing', value: !stateRef.current.isPlaying }),
      play: () => dispatch({ type: 'set-playing', value: true }),
      pause: () => dispatch({ type: 'set-playing', value: false }),
      next: () => dispatch({ type: 'advance', delta: 1 }),
      previous: () => {
        const audio = audioRef.current;
        // Match the convention: "previous" restarts the track unless you press it early.
        if (audio && audio.currentTime > 3) {
          seek(0);
          return;
        }
        dispatch({ type: 'advance', delta: -1 });
      },
      jump: (index) => dispatch({ type: 'jump', index }),
      seek,
      seekBy,
      setVolume: (value) => dispatch({ type: 'set-volume', value }),
      toggleMute: () => dispatch({ type: 'toggle-mute' }),
      toggleShuffle: () => dispatch({ type: 'toggle-shuffle' }),
      cycleRepeat: () => dispatch({ type: 'cycle-repeat' }),
      enqueue: (ids, next = false) => dispatch({ type: 'enqueue', ids, next }),
      removeAt: (index) => dispatch({ type: 'remove', index }),
      moveInQueue: (from, to) => dispatch({ type: 'move', from, to }),
      clearUpcoming: () => dispatch({ type: 'clear-upcoming' }),
    }),
    [state, current, upcoming, analyser, error, sleepTimer, seek, seekBy],
  );

  return (
    <PlayerContext.Provider value={api}>
      <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerApi {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return value;
}

export function useProgress() {
  return useContext(ProgressContext);
}
