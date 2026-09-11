import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { read, write } from '../lib/storage';

export type Theme = 'auto' | 'light' | 'dark';

interface UiApi {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toast: string | null;
  notify: (message: string) => void;
}

const UiContext = createContext<UiApi | null>(null);

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => read<Theme>('theme', 'auto'));
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolve(theme));
    apply();
    if (theme !== 'auto') return;
    const query = window.matchMedia('(prefers-color-scheme: light)');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    write('theme', next);
  }, []);

  const notify = useCallback((message: string) => {
    window.clearTimeout(timerRef.current);
    setToast(message);
    timerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const value = useMemo(() => ({ theme, setTheme, toast, notify }), [theme, setTheme, toast, notify]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiApi {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi must be used inside <UiProvider>');
  return value;
}
