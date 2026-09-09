const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/**
 * Wakes the API before anybody asks it for anything.
 *
 * The two halves of this application have very different startup costs. The frontend is static
 * files on a CDN and appears more or less instantly. The API is a serverless function with no
 * process running between requests, in front of a database that sleeps when idle — so the first
 * call after a quiet spell waits for both to come back.
 *
 * On a free plan that cost cannot be removed. It can, however, be spent somewhere nobody is
 * looking. Between a page appearing and a visitor typing an email and a password there are
 * several seconds of human time, and that is more than enough: this fires the moment the app
 * mounts, so the login they submit afterwards arrives at something already awake.
 *
 * Deliberately silent. Nothing renders differently because of it, nothing waits for it, and a
 * failure is ignored — it is an optimisation, and an optimisation that can break the page is
 * not worth having. `keepalive` lets it outlive a quick navigation.
 */
export function warmUpApi(): void {
  try {
    void fetch(`${API_URL}/health`, { method: 'GET', keepalive: true }).catch(() => {})
  } catch {
    // Older browsers without fetch, or a blocked request. Neither is worth reporting.
  }
}

/**
 * Fetches the 3D bundle while the browser is idle.
 *
 * Three.js and the room are code-split so the login card does not have to wait for ~360 KB it
 * may never use. That is right for the *first* paint and wrong for the moment afterwards: by
 * then the visitor is almost certainly on their way in, and the download would land squarely
 * between them and the room.
 *
 * `requestIdleCallback` waits for the browser to have nothing better to do, so this never
 * competes with rendering the page it is loading behind. Vite resolves it to the same chunk the
 * lazy route uses, so entering the room afterwards costs nothing at all.
 */
export function prefetchRoom(): void {
  const load = () => void import('../pages/RoomPage').catch(() => {})

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 3000 })
  } else {
    // Safari, at time of writing. A plain delay is a reasonable stand-in.
    window.setTimeout(load, 1500)
  }
}
