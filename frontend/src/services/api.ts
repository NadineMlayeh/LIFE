import axios from 'axios'

/**
 * The one place the frontend knows where the API is.
 *
 * `VITE_API_URL` is substituted at build time rather than read at runtime, so changing it on
 * the host means rebuilding, not restarting. Falls back to the local API so a fresh clone runs
 * with no configuration at all.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL

/*
  A production build with no `VITE_API_URL` would quietly fall back to localhost, and the
  deployed site would then ask every visitor's own machine for the API — a failure that reads
  as "the server is down" from the browser and looks perfectly healthy from the host. Saying so
  once, loudly, is the difference between a five-minute fix and an afternoon.
*/
if (import.meta.env.PROD && !configuredApiUrl) {
  console.error(
    'VITE_API_URL was not set when this was built, so the app is looking for the API on ' +
      'localhost. Set it on the host and redeploy — it is baked in at build time.',
  )
}

export const api = axios.create({
  baseURL: configuredApiUrl ?? 'http://localhost:3000',
})

// Every request carries the token if there is one. Kept in localStorage, which is readable by
// any script on the page — an accepted trade for a single-page app with no server rendering,
// and the reason nothing more sensitive than a session token is stored client-side.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('life_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * A token the server no longer accepts is a token worth discarding: without this, an expired
 * session leaves the app looking logged in while every request quietly fails.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''
    // Not on the login route itself, where a 401 means "wrong password", not "session over".
    if (status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('life_token')
    }
    return Promise.reject(error)
  },
)
