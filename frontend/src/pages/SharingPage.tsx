import { useEffect, useState } from 'react'
import { getErrorMessage } from '../services/apiError'
import { shareLinksApi } from '../services/lifeApi'
import type { ShareLink } from '../types'

export function SharingPage() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function load() {
    try {
      setLinks(await shareLinksApi.list())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your share links.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate() {
    try {
      await shareLinksApi.create()
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create a share link.'))
    }
  }

  async function onRevoke(link: ShareLink) {
    if (!confirm('Revoke this link? Anyone holding it will immediately lose access.')) return
    try {
      await shareLinksApi.revoke(link.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not revoke the link.'))
    }
  }

  function urlFor(link: ShareLink) {
    return `${window.location.origin}/share/${link.token}`
  }

  async function onCopy(link: ShareLink) {
    await navigator.clipboard.writeText(urlFor(link))
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>

  const active = links.filter((link) => !link.revoked)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Sharing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          A share link shows only what you have marked <strong>Shared</strong>. Everything else
          stays invisible — it is never sent to the browser at all.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={onCreate}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Create a share link
      </button>

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
          No active share links.
        </p>
      ) : (
        <ul className="space-y-3">
          {active.map((link) => (
            <li key={link.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <code className="block break-all text-xs text-neutral-600">{urlFor(link)}</code>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <button
                  onClick={() => onCopy(link)}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
                >
                  {copiedId === link.id ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={urlFor(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
                >
                  Preview
                </a>
                <button onClick={() => onRevoke(link)} className="text-red-600 hover:underline">
                  Revoke
                </button>
                <span className="ml-auto text-neutral-400">
                  created {new Date(link.createdAt).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {links.some((link) => link.revoked) && (
        <p className="text-xs text-neutral-400">
          {links.filter((l) => l.revoked).length} revoked link
          {links.filter((l) => l.revoked).length === 1 ? '' : 's'} no longer work.
        </p>
      )}
    </div>
  )
}
