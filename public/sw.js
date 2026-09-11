/* Offline support for Kiarash Play.
 *
 * The app shell is cached as it is requested; audio is cached only when the page
 * explicitly asks for it, because media requests arrive as Range requests that a
 * naive cache-first handler would answer incorrectly.
 */
const VERSION = 'v1';
const SHELL = `kp-shell-${VERSION}`;
const MEDIA = `kp-media-${VERSION}`;
const MEDIA_LIMIT = 80;

const scope = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([scope.pathname, `${scope.pathname}library.json`]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL && key !== MEDIA).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isMedia(url) {
  return url.pathname.includes('/media/audio/');
}

/** Answer a Range request out of a fully cached response. */
async function slice(response, range) {
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) return response;
  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  const start = match[1] === '' ? size - Number(match[2]) : Number(match[1]);
  const end = match[2] === '' || match[1] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (Number.isNaN(start) || start >= size) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
  }
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    headers: {
      'content-type': response.headers.get('content-type') || 'audio/mpeg',
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': String(end - start + 1),
      'accept-ranges': 'bytes',
    },
  });
}

async function trimMedia() {
  const cache = await caches.open(MEDIA);
  const keys = await cache.keys();
  // Oldest entries first; drop enough to get back under the limit.
  for (let i = 0; i < keys.length - MEDIA_LIMIT; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function handleMedia(request) {
  const cache = await caches.open(MEDIA);
  const cached = await cache.match(request.url, { ignoreVary: true });
  const range = request.headers.get('range');
  if (cached) return range ? slice(cached.clone(), range) : cached.clone();

  try {
    const response = await fetch(request);
    if (response.ok && !range) {
      await cache.put(request.url, response.clone());
      await trimMedia();
    }
    return response;
  } catch {
    return new Response('Offline and not cached', { status: 503 });
  }
}

async function handleShell(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request, { ignoreSearch: false });
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  // Stale-while-revalidate: paint from cache, refresh in the background.
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isMedia(url)) {
    event.respondWith(handleMedia(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(scope.pathname).then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(handleShell(request));
});

/**
 * The page asks for a full copy of a track once it starts playing, because the
 * audio element itself only ever issues Range requests.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'cache-audio' || typeof data.url !== 'string') return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(MEDIA);
      if (await cache.match(data.url, { ignoreVary: true })) return;
      try {
        const response = await fetch(data.url, { cache: 'no-store' });
        if (response.ok) {
          await cache.put(data.url, response);
          await trimMedia();
        }
      } catch {
        // Nothing to do; it will be tried again next time the track plays.
      }
    })(),
  );
});
