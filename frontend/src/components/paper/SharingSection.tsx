import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { shareLinksApi } from '../../services/lifeApi'
import type { ShareLink } from '../../types'
import { ConfirmBubble, Hint } from './fields'

/**
 * Who may come in, kept in the mirror.
 *
 * The mirror is where you look at yourself and decide what of you is on show, so the keys to
 * the room belong here rather than in a settings page. The room has no settings page, by
 * design: nothing about LIFE should be administered from outside it.
 *
 * A link is only a door. **What is behind the door is decided per object**, by the seals on
 * the timeline, the books, the map, the album and the identity record. Holding a link and
 * being shown something are two different permissions, and this panel only grants the first.
 */
export function SharingSection({ active }: { active: boolean }) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [lifespanChoice, setLifespanChoice] = useState<'7' | '30' | '365' | 'never'>('30')
  const [confirming, setConfirming] = useState<{ id: string; at: DOMRect } | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!active || loaded.current) return
    loaded.current = true
    shareLinksApi
      .list()
      .then(setLinks)
      .catch((err) => setError(getErrorMessage(err, 'Could not read your keys.')))
      .finally(() => setLoading(false))
  }, [active])

  // A lapsed key is as dead as a revoked one, so it does not belong in the list of live keys.
  const live = links.filter((l) => !l.revoked && !hasLapsed(l))

  async function cut() {
    setBusy(true)
    try {
      const created = await shareLinksApi.create(lifespanChoice)
      setLinks((current) => [created, ...current])
    } catch (err) {
      setError(getErrorMessage(err, 'Could not cut a new key.'))
    } finally {
      setBusy(false)
    }
  }

  function urlFor(token: string) {
    return `${window.location.origin}/share/${token}`
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(urlFor(token))
      setCopied(token)
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1800)
    } catch {
      setError('Your browser would not let the page copy that. Select it by hand instead.')
    }
  }

  if (loading) return <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>

  return (
    <div>
      {error && <p className="mb-4 text-sm break-words text-[var(--oxblood)]">{error}</p>}

      <p className="mb-6 text-[14px] leading-relaxed text-[var(--ink-soft)]">
        A key opens your room to whoever holds it. What they find inside is a separate question
        — each object carries its own seal, and anything you have not shared simply will not
        open for them. Most keys lapse on their own; one meant for a public post can be set to
        last forever.
      </p>

      <p className="small-caps mb-3">Keys you have cut · {live.length}</p>

      <ul className="space-y-1">
        {live.map((link) => (
          <li
            key={link.id}
            className="flex items-center gap-3 border-b py-2.5"
            style={{ borderColor: 'var(--rule)' }}
          >
            <span className="min-w-0 flex-1">
              <code
                className="block truncate text-[12px] text-[var(--ink-soft)]"
                title={urlFor(link.token)}
              >
                {urlFor(link.token)}
              </code>
              <span className="text-[11px] text-[var(--ink-faint)]">{lifespan(link)}</span>
            </span>

            <button onClick={() => copy(link.token)} className="quiet-button shrink-0 !p-0">
              {copied === link.token ? 'Copied' : 'Copy'}
            </button>

            <Hint text="Close this door for good. Anyone holding this key loses their way in immediately.">
              <button
                onClick={(e) =>
                  setConfirming({ id: link.id, at: e.currentTarget.getBoundingClientRect() })
                }
                className="quiet-button shrink-0 !p-0"
                style={{ color: 'var(--oxblood)' }}
              >
                Revoke
              </button>
            </Hint>
          </li>
        ))}

        {live.length === 0 && (
          <li className="py-6 text-[13px] italic text-[var(--ink-faint)]">
            No keys. Nobody can reach your room.
          </li>
        )}
      </ul>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="min-w-0">
          <span className="small-caps mb-1 block">This key should last</span>
          <select
            value={lifespanChoice}
            onChange={(e) => setLifespanChoice(e.target.value as typeof lifespanChoice)}
            className="ruled-field"
          >
            <option value="7">A week</option>
            <option value="30">A month</option>
            <option value="365">A year</option>
            <option value="never">Forever</option>
          </select>
        </label>

        <button onClick={cut} disabled={busy} className="brass-button">
          {busy ? 'Cutting…' : 'Cut a new key'}
        </button>
      </div>

      {lifespanChoice === 'never' && (
        <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-faint)]">
          A key that never lapses is the right one to post publicly — on a CV or a profile,
          where a door closing three weeks later would be worse than leaving it open. It is the
          wrong one to hand to a single person, because you have to remember to take it back.
        </p>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-[var(--ink-faint)]">
        Writing a letter? You can enclose a key with it from the mailbox, without copying
        anything from here.
      </p>

      <ConfirmBubble
        anchor={confirming?.at ?? null}
        question="Revoke this key? Anyone holding it loses their way in immediately."
        confirmLabel="Revoke it"
        onDismiss={() => setConfirming(null)}
        onConfirm={async () => {
          if (!confirming) return
          const id = confirming.id
          setConfirming(null)
          try {
            await shareLinksApi.revoke(id)
            setLinks((current) => current.filter((l) => l.id !== id))
          } catch (err) {
            setError(getErrorMessage(err, 'Could not revoke that key.'))
          }
        }}
      />
    </div>
  )
}

function hasLapsed(link: ShareLink): boolean {
  return link.expiresAt !== null && new Date(link.expiresAt) < new Date()
}

/** How long a key has left, in the plainest words that are still accurate. */
function lifespan(link: ShareLink): string {
  if (!link.expiresAt) return 'Never lapses'
  const days = Math.ceil((new Date(link.expiresAt).getTime() - Date.now()) / 86_400_000)
  if (days <= 0) return 'Lapsed'
  if (days === 1) return 'Lapses tomorrow'
  return `Lapses in ${days} days`
}
