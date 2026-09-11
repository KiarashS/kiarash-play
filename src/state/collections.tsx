import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { read, write } from '../lib/storage';

const RECENT_LIMIT = 30;

interface Collections {
  liked: string[];
  likedSet: Set<string>;
  recent: string[];
  plays: Record<string, number>;
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => void;
  markPlayed: (id: string) => void;
}

const CollectionsContext = createContext<Collections | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = useState<string[]>(() => read<string[]>('liked', []));
  const [recent, setRecent] = useState<string[]>(() => read<string[]>('recent', []));
  const [plays, setPlays] = useState<Record<string, number>>(() => read<Record<string, number>>('plays', {}));

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      // Newest first, so the Liked view reads as a timeline.
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      write('liked', next);
      return next;
    });
  }, []);

  const markPlayed = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
      write('recent', next);
      return next;
    });
    setPlays((prev) => {
      const next = { ...prev, [id]: (prev[id] ?? 0) + 1 };
      write('plays', next);
      return next;
    });
  }, []);

  const value = useMemo<Collections>(() => {
    const likedSet = new Set(liked);
    return {
      liked,
      likedSet,
      recent,
      plays,
      isLiked: (id) => likedSet.has(id),
      toggleLike,
      markPlayed,
    };
  }, [liked, recent, plays, toggleLike, markPlayed]);

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
}

export function useCollections(): Collections {
  const value = useContext(CollectionsContext);
  if (!value) throw new Error('useCollections must be used inside <CollectionsProvider>');
  return value;
}
