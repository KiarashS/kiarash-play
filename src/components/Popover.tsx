import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  anchor: HTMLElement;
  onClose: () => void;
  align?: 'left' | 'right';
  children: ReactNode;
}

/** A small floating menu that stays inside the viewport and closes on Escape or outside click. */
export function Popover({ anchor, onClose, align = 'right', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const box = anchor.getBoundingClientRect();
    const size = menu.getBoundingClientRect();
    const margin = 10;

    let left = align === 'right' ? box.right - size.width : box.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - size.width - margin));

    // Flip above the anchor when there is no room below it.
    let top = box.bottom + 6;
    if (top + size.height > window.innerHeight - margin) {
      top = Math.max(margin, box.top - size.height - 6);
    }
    setPosition({ top, left });
  }, [anchor, align]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={ref} className="menu glass glass--lit" role="menu" style={{ top: position.top, left: position.left }}>
      {children}
    </div>,
    document.body,
  );
}
