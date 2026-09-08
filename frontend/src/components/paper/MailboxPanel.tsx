import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { mailboxApi } from '../../services/lifeApi'
import type { Letter } from '../../types'
import { ConfirmBubble, Hint } from './fields'
import { Panel } from './Panel'

type View = 'inbox' | 'sent' | 'write'

/**
 * The mailbox: letters between lives.
 *
 * Two decisions worth keeping:
 *
 * **Letters are addressed by username.** Requiring an email address would mean you could only
 * write to someone whose address you already had, which is exactly what usernames exist to
 * avoid. The name is checked as you type, so nobody writes a whole letter to a person who
 * does not exist.
 *
 * **An invitation is enclosed from inside the letter.** Copying a key out of the mirror,
 * remembering it, and pasting it into a letter is three steps and a chance to paste the wrong
 * thing. Ticking a box here has the server attach the writer's own key — which it reuses
 * rather than minting a new one, so revoking closes every door at once.
 */
export function MailboxPanel({
  open,
  onClose,
  onUnreadChanged,
}: {
  open: boolean
  onClose: () => void
  /** Lets the room re-count what is waiting. */
  onUnreadChanged: () => void
}) {
  const [view, setView] = useState<View>('inbox')
  const [inbox, setInbox] = useState<Letter[]>([])
  const [sent, setSent] = useState<Letter[]>([])
  const [reading, setReading] = useState<Letter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  async function load() {
    try {
      const [i, s] = await Promise.all([mailboxApi.inbox(), mailboxApi.sent()])
      setInbox(i)
      setSent(s)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open your mailbox.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || loaded.current) return
    loaded.current = true
    load()
  }, [open])

  async function openLetter(letter: Letter) {
    setReading(letter)
    if (letter.readAt || view === 'sent') return
    try {
      const updated = await mailboxApi.markRead(letter.id)
      setInbox((current) => current.map((l) => (l.id === letter.id ? updated : l)))
      onUnreadChanged()
    } catch {
      // Failing to mark it read is not worth interrupting the reading for.
    }
  }

  const unread = inbox.filter((l) => !l.readAt).length
  const letters = view === 'sent' ? sent : inbox

  return (
    <Panel
      open={open}
      onClose={() => {
        setReading(null)
        onClose()
      }}
      subtitle={reading ? (view === 'sent' ? 'You wrote' : `From ${reading.sender.username}`) : 'The mailbox'}
      title={reading ? reading.subject : 'Letters'}
      variant="spread"
      steady
      actions={
        reading ? (
          <button onClick={() => setReading(null)} className="quiet-button">
            ← Back to the letters
          </button>
        ) : null
      }
    >
      {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>
      ) : reading ? (
        <ReadLetter
          letter={reading}
          mine={view === 'sent'}
          onDeleted={async () => {
            setReading(null)
            await load()
            onUnreadChanged()
          }}
        />
      ) : (
        <>
          {error && <p className="mb-4 text-sm break-words text-[var(--oxblood)]">{error}</p>}

          <nav className="mb-5 flex items-center gap-1 border-b pb-2" style={{ borderColor: 'var(--rule)' }}>
            {(
              [
                ['inbox', unread > 0 ? `Received · ${unread} unread` : 'Received'],
                ['sent', 'Sent'],
                ['write', 'Write a letter'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className="relative px-3 py-1.5 text-[13px] transition"
                style={{ color: view === key ? 'var(--ink)' : 'var(--ink-faint)' }}
              >
                {label}
                {view === key && (
                  <span
                    className="absolute inset-x-2 -bottom-[9px] block h-[2px]"
                    style={{ backgroundColor: 'var(--brass)' }}
                  />
                )}
              </button>
            ))}
          </nav>

          {view === 'write' ? (
            <Compose
              onSent={async () => {
                await load()
                setView('sent')
              }}
            />
          ) : (
            <ul>
              {letters.map((letter) => (
                <li key={letter.id}>
                  <button
                    onClick={() => openLetter(letter)}
                    className="flex w-full min-w-0 items-baseline gap-3 border-b py-3 text-left transition hover:opacity-70"
                    style={{ borderColor: 'var(--rule)' }}
                  >
                    {view === 'inbox' && (
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ backgroundColor: letter.readAt ? 'transparent' : 'var(--oxblood)' }}
                      />
                    )}
                    <span className="w-32 shrink-0 truncate text-[13px] text-[var(--ink-soft)]">
                      {view === 'sent' ? `to ${letter.recipient.username}` : letter.sender.username}
                    </span>
                    <span className="display min-w-0 flex-1 truncate text-[16px]">
                      {letter.subject}
                    </span>
                    {letter.shareToken && (
                      <span className="small-caps shrink-0 text-[var(--brass)]">key enclosed</span>
                    )}
                    <span className="shrink-0 text-[11px] text-[var(--ink-faint)]">
                      {new Date(letter.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}

              {letters.length === 0 && (
                <li className="py-10 text-center text-[13px] italic text-[var(--ink-faint)]">
                  {view === 'sent' ? 'You have not written to anyone yet.' : 'No letters yet.'}
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

/** A letter, opened. Laid out as a sheet with a salutation and a hand at the bottom. */
function ReadLetter({
  letter,
  mine,
  onDeleted,
}: {
  letter: Letter
  mine: boolean
  onDeleted: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState<DOMRect | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className="mx-auto max-w-2xl">
      <p className="small-caps mb-6 text-[var(--ink-faint)]">
        {new Date(letter.createdAt).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>

      <p
        className="text-[15px] leading-[1.9] whitespace-pre-wrap text-[var(--ink)]"
        style={{ overflowWrap: 'anywhere' }}
      >
        {letter.body}
      </p>

      <p className="mt-8 text-right text-[15px] italic text-[var(--ink-soft)]">
        — {mine ? 'you' : letter.sender.username}
      </p>

      {letter.shareToken && (
        <div
          className="mt-8 rounded-[2px] border p-4 text-center"
          style={{ borderColor: 'var(--brass)', backgroundColor: 'rgba(176,141,87,0.09)' }}
        >
          <p className="small-caps mb-2">Enclosed</p>
          <p className="mb-3 text-[13px] text-[var(--ink-soft)]">
            {mine
              ? `${letter.recipient.username} can let themselves into your room with this.`
              : `${letter.sender.username} has invited you into their room.`}
          </p>
          <a href={`/share/${letter.shareToken}`} className="brass-button inline-block">
            {mine ? 'See what they will see' : `Visit ${letter.sender.username}`}
          </a>
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Hint text="Remove this letter. It disappears for both of you.">
          <button
            onClick={(e) => setConfirming(e.currentTarget.getBoundingClientRect())}
            className="quiet-button !p-0"
            style={{ color: 'var(--oxblood)' }}
          >
            Burn it
          </button>
        </Hint>
      </div>

      <ConfirmBubble
        anchor={confirming}
        question="Burn this letter? It disappears for both of you."
        confirmLabel="Burn it"
        busy={busy}
        onDismiss={() => setConfirming(null)}
        onConfirm={async () => {
          setBusy(true)
          try {
            await mailboxApi.remove(letter.id)
            await onDeleted()
          } finally {
            setBusy(false)
            setConfirming(null)
          }
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,23}$/

function Compose({ onSent }: { onSent: () => Promise<void> }) {
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [enclose, setEnclose] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const who = useRecipientCheck(recipient)
  const canSend =
    who.state === 'found' && subject.trim().length > 0 && body.trim().length > 0 && !sending

  async function send(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await mailboxApi.send({
        recipient: recipient.trim(),
        subject: subject.trim(),
        body: body.trim(),
        enclose,
      })
      setRecipient('')
      setSubject('')
      setBody('')
      setEnclose(false)
      await onSent()
    } catch (err) {
      setError(getErrorMessage(err, 'The letter could not be sent.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={send} className="mx-auto max-w-2xl space-y-3.5">
      {error && <p className="text-sm break-words text-[var(--oxblood)]">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className="block">
            <span className="small-caps mb-1 block">To</span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Their username"
              className="ruled-field w-full"
              autoComplete="off"
            />
          </label>
          <p
            className="mt-1 h-4 text-[12px]"
            style={{
              color:
                who.state === 'missing' ? 'var(--oxblood)'
                : who.state === 'found' ? 'var(--forest)'
                : 'var(--ink-faint)',
            }}
          >
            {who.note}
          </p>
        </div>

        <label className="block min-w-0">
          <span className="small-caps mb-1 block">Concerning</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What it is about"
            className="ruled-field w-full"
          />
        </label>
      </div>

      <label className="block">
        <span className="small-caps mb-1 block">The letter</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write freely…"
          rows={5}
          className="w-full resize-y border-b border-transparent bg-transparent text-[15px] leading-[1.8] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] placeholder:italic focus:border-[var(--rule)]"
          style={{ overflowWrap: 'anywhere' }}
        />
      </label>

      {/* The key and the send button share a line. Enclosing an invitation is part of sending
          the letter, not a separate section below it — and putting it below the fold meant you
          had to go looking for the feature this whole panel exists to make easy. */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-[2px] border px-4 py-3"
        style={{ borderColor: 'var(--rule)', backgroundColor: 'rgba(176,141,87,0.06)' }}
      >
        <label className="flex min-w-0 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enclose}
            onChange={(e) => setEnclose(e.target.checked)}
            className="shrink-0 accent-[var(--brass)]"
          />
          <span className="min-w-0">
            <span className="block text-[14px] text-[var(--ink)]">Enclose a key to my room</span>
            <span className="block text-[12px] leading-snug text-[var(--ink-faint)]">
              They see only what you have already shared. Revoke it any time from the mirror.
            </span>
          </span>
        </label>

        <button disabled={!canSend} className="brass-button shrink-0">
          {sending ? 'Sending…' : 'Send it'}
        </button>
      </div>
    </form>
  )
}

/**
 * Checks the name belongs to somebody, once typing has stopped and only when the shape could
 * be a username at all. Nobody should write a whole letter to a person who does not exist.
 */
function useRecipientCheck(username: string) {
  const [state, setState] = useState<'idle' | 'checking' | 'found' | 'missing'>('idle')
  const seq = useRef(0)

  useEffect(() => {
    if (!USERNAME_PATTERN.test(username.trim())) {
      setState('idle')
      return
    }
    setState('checking')
    const mine = ++seq.current
    const timer = setTimeout(async () => {
      try {
        const res = await mailboxApi.findRecipient(username.trim())
        if (seq.current === mine) setState(res.found ? 'found' : 'missing')
      } catch {
        if (seq.current === mine) setState('idle')
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [username])

  const note =
    username.trim().length === 0
      ? 'Letters are addressed by username, never by email.'
      : !USERNAME_PATTERN.test(username.trim())
        ? 'That is not the shape of a username.'
        : state === 'checking'
          ? 'Looking…'
          : state === 'missing'
            ? 'Nobody here goes by that name.'
            : state === 'found'
              ? `${username.trim()} will receive this.`
              : ''

  return { state, note }
}

/** A small brass count of what is waiting, for the room to show on the mailbox. */
export function useUnreadLetters(active: boolean) {
  const [count, setCount] = useState(0)

  const refresh = () => {
    mailboxApi
      .unreadCount()
      .then(setCount)
      .catch(() => setCount(0))
  }

  useEffect(() => {
    if (!active) return
    refresh()
  }, [active])

  return { count, refresh }
}
