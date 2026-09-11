import { useEffect } from 'react';
import { usePlayer } from './PlayerContext';
import { useCollections } from '../state/collections';
import { useUi } from '../state/ui';

interface Handlers {
  onSearch: () => void;
  onQueue: () => void;
  onLyrics: () => void;
  onStage: () => void;
  onShortcuts: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  );
}

export function useShortcuts({ onSearch, onQueue, onLyrics, onStage, onShortcuts }: Handlers): void {
  const player = usePlayer();
  const { toggleLike } = useCollections();
  const { notify } = useUi();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K opens search even from a field; everything else stays out of the way.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onSearch();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;

      const step = event.shiftKey ? 30 : 5;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          player.toggle();
          break;
        case 'ArrowRight':
          event.preventDefault();
          player.seekBy(step);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          player.seekBy(-step);
          break;
        case 'ArrowUp':
          event.preventDefault();
          player.setVolume(Math.min(1, player.volume + 0.05));
          break;
        case 'ArrowDown':
          event.preventDefault();
          player.setVolume(Math.max(0, player.volume - 0.05));
          break;
        case '/':
          event.preventDefault();
          onSearch();
          break;
        case '?':
          event.preventDefault();
          onShortcuts();
          break;
        default:
          break;
      }

      switch (event.key.toLowerCase()) {
        case 'n':
          if (event.shiftKey) player.next();
          break;
        case 'p':
          if (event.shiftKey) player.previous();
          break;
        case 'm':
          player.toggleMute();
          break;
        case 's':
          player.toggleShuffle();
          notify(player.shuffle ? 'Shuffle off' : 'Shuffle on');
          break;
        case 'r': {
          player.cycleRepeat();
          const next = player.repeat === 'off' ? 'all' : player.repeat === 'all' ? 'one' : 'off';
          notify(`Repeat ${next}`);
          break;
        }
        case 'q':
          onQueue();
          break;
        case 'l':
          onLyrics();
          break;
        case 'f':
          onStage();
          break;
        case 'h':
          if (player.current) {
            toggleLike(player.current.id);
            notify('Liked toggled');
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, toggleLike, notify, onSearch, onQueue, onLyrics, onStage, onShortcuts]);
}
