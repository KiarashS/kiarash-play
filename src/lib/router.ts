import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { view: 'home' }
  | { view: 'playlist'; id: string }
  | { view: 'liked' }
  | { view: 'recent' }
  | { view: 'all' };

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const [head, tail] = path.split('/');
  if (head === 'playlist' && tail) return { view: 'playlist', id: decodeURIComponent(tail) };
  if (head === 'liked') return { view: 'liked' };
  if (head === 'recent') return { view: 'recent' };
  if (head === 'tracks') return { view: 'all' };
  return { view: 'home' };
}

export function href(route: Route): string {
  switch (route.view) {
    case 'playlist':
      return `#/playlist/${encodeURIComponent(route.id)}`;
    case 'liked':
      return '#/liked';
    case 'recent':
      return '#/recent';
    case 'all':
      return '#/tracks';
    default:
      return '#/';
  }
}

/** Hash routing keeps deep links working on static hosts with no rewrite rules. */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = href(next);
  }, []);

  return [route, navigate];
}
