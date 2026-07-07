/**
 * Player Portal service worker.
 *
 * Phase 1b caching strategy — designed to speed up static assets and
 * icons without ever risking stale authenticated data. If a strategy
 * isn't obvious from the URL, the safe default is NETWORK (pass-through)
 * so we never accidentally serve one user's dashboard payload to another.
 *
 *   Navigations                      → network-first, /offline fallback
 *   /_next/static/*                  → cache-first (name-hashed, immutable)
 *   /icon-*.png, /icon.svg, apple/favicon → cache-first
 *   Fonts (*.woff2, *.woff, *.ttf)  → cache-first
 *   Images at other paths            → stale-while-revalidate
 *   /manifest.json                   → network-first, cache fallback
 *   /api/**  (GET or otherwise)      → pass-through (never cached)
 *   Non-GET methods anywhere         → pass-through
 *   Anything else                    → pass-through
 *
 * Version-bump `VERSION` on every SW-file change so activate() cleans
 * up stale caches from previous releases.
 */

// eslint-disable-next-line no-unused-vars
const VERSION = 'v2'
const PRECACHE = `player-portal-precache-${VERSION}`
const STATIC_CACHE = `player-portal-static-${VERSION}`
const IMAGE_CACHE = `player-portal-images-${VERSION}`
const CURRENT_CACHES = new Set([PRECACHE, STATIC_CACHE, IMAGE_CACHE])

// URLs precached at install. Keep this list tiny — anything here has
// to succeed on install or the whole SW registration fails. Every
// entry must be a stable, unversioned public URL.
const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      // Add each entry with `{ cache: 'reload' }` so we get a fresh copy
      // from the network on install, not a possibly-stale HTTP cache hit.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            // Non-fatal — a single missing precache asset shouldn't
            // block the entire SW installation.
          })
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('player-portal-') && !CURRENT_CACHES.has(k))
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ─── helpers ───────────────────────────────────────────────────────────

function isNextStatic(url) {
  return url.pathname.startsWith('/_next/static/')
}

function isRootIcon(url) {
  return (
    url.pathname === '/icon.svg' ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon-32.png' ||
    url.pathname === '/favicon.ico'
  )
}

function isFont(url) {
  return /\.(?:woff2|woff|ttf|otf)$/.test(url.pathname)
}

function isImage(url) {
  return /\.(?:png|jpe?g|webp|gif|svg|avif)$/.test(url.pathname)
}

function isApi(url) {
  return url.pathname.startsWith('/api/')
}

function isManifest(url) {
  return url.pathname === '/manifest.json'
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    // No network + no cache — surface the error rather than pretending.
    return new Response('Asset unavailable offline', { status: 504 })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(PRECACHE)
    const offline = await cache.match('/offline')
    return offline || new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function networkFirstManifest(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(PRECACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(PRECACHE)
    const cached = await cache.match(request)
    return cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } })
  }
}

// ─── fetch router ──────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Rule 1 — only handle same-origin.
  if (url.origin !== self.location.origin) return

  // Rule 2 — only handle GET. Never intercept POST/PUT/PATCH/DELETE.
  if (request.method !== 'GET') return

  // Rule 3 — never touch /api/*. Authenticated data must always be fresh.
  if (isApi(url)) return

  // Rule 4 — navigations: network-first with offline fallback (preserves
  // pre-existing behaviour and ensures dashboards are never stale).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  // Rule 5 — manifest: network-first, cache fallback.
  if (isManifest(url)) {
    event.respondWith(networkFirstManifest(request))
    return
  }

  // Rule 6 — cache-first for Next.js static bundles (immutable, name-hashed).
  if (isNextStatic(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Rule 7 — cache-first for our root icons + favicon.
  if (isRootIcon(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Rule 8 — cache-first for fonts (heavy + rarely change).
  if (isFont(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Rule 9 — stale-while-revalidate for other images (marketing photos,
  // logo variants, etc.). Never enters STATIC_CACHE so it doesn't crowd
  // out the immutable static bundles.
  if (isImage(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
    return
  }

  // Everything else: pass through to the network. Do nothing.
})

// ─── push notifications (preserved from v1) ────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'Player Portal'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/dashboard' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    // Focus an existing Player Portal tab if one is open; only fall
    // back to opening a new window when nothing is already open. This
    // avoids stacking multiple tabs when the same push fires more
    // than once (e.g. background retries).
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      for (const client of all) {
        try {
          const clientUrl = new URL(client.url)
          if (clientUrl.origin === self.location.origin) {
            return client
              .focus()
              .then(() => (client.navigate ? client.navigate(target) : undefined))
          }
        } catch { /* client.url malformed — skip */ }
      }
      return self.clients.openWindow(target)
    })
  )
})
