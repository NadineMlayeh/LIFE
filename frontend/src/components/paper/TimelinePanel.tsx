import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { booksApi, privacyApi, timelineApi } from '../../services/lifeApi'
import type { Book, TimelineEvent, Visibility } from '../../types'
import { describeGap, formatEventDate } from '../../utils/dates'
import { ConfirmBubble, Field, PrivacySeal, TextArea } from './fields'
import { Panel } from './Panel'

/**
 * The timeline as an engraved scale rather than a list.
 *
 * Two rules from the spec drive the whole layout:
 *  - spacing is *normalised* — every event gets the same rung, so a twenty-year gap does not
 *    leave a screen of emptiness (C.3.1);
 *  - the real elapsed time lives on the connector between two rungs instead (C.3.2).
 *
 * Past is inked solid, the present is emphasised, the future is drawn in outline.
 */
export function TimelinePanel({
  open,
  onClose,
  userId,
}: {
  open: boolean
  onClose: () => void
  userId: string
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [jumpDate, setJumpDate] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE')

  const scrollRef = useRef<HTMLDivElement>(null)
  const rungRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const loaded = useRef(false)

  async function load(term = search) {
    try {
      const [eventList, bookList, privacy] = await Promise.all([
        timelineApi.list(term || undefined),
        booksApi.list(),
        userId
          ? privacyApi.get('TIMELINE', [userId])
          : Promise.resolve({} as Record<string, Visibility>),
      ])
      setEvents(eventList)
      setBooks(bookList)
      if (userId) setVisibility(privacy[userId] ?? 'PRIVATE')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not read your timeline.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || loaded.current) return
    loaded.current = true
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!loaded.current) return
    const t = setTimeout(() => load(search), 260)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const now = Date.now()

  const dueGoals = useMemo(
    () =>
      events.filter(
        (e) => e.isGoal && e.goalStatus === 'PENDING' && new Date(e.date).getTime() <= now,
      ),
    [events, now],
  )

  // The rung closest to today, marked as "now" on the scale.
  const presentId = useMemo(() => {
    let best: string | null = null
    let bestDelta = Infinity
    for (const e of events) {
      const d = Math.abs(new Date(e.date).getTime() - now)
      if (d < bestDelta) {
        bestDelta = d
        best = e.id
      }
    }
    return best
  }, [events, now])

  function jumpToNearest(e: FormEvent) {
    e.preventDefault()
    if (!jumpDate || events.length === 0) return
    const target = new Date(jumpDate).getTime()
    const nearest = events.reduce((best, ev) =>
      Math.abs(new Date(ev.date).getTime() - target) <
      Math.abs(new Date(best.date).getTime() - target)
        ? ev
        : best,
    )
    const node = rungRefs.current[nearest.id]
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setExpanded(nearest.id)
  }

  async function resolveGoal(id: string, goalStatus: 'ACHIEVED' | 'NOT_ACHIEVED') {
    await timelineApi.update(id, { goalStatus })
    await load()
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      subtitle="The clock"
      title="A life in order"
      variant="scroll"
      steady
      actions={
        <>
          {/* One switch for the whole chronology. Per-event seals cluttered every rung, and
              the owner would rather share the timeline entire or not at all. */}
          <PrivacySeal
            entityType="TIMELINE"
            entityId={userId}
            value={visibility}
            onChanged={setVisibility}
          />
          <button onClick={() => setComposing((v) => !v)} className="brass-button">
            {composing ? 'Cancel' : 'Add a moment'}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Reading…</p>
      ) : (
        <div ref={scrollRef}>
          {error && <p className="mb-4 text-sm text-[var(--oxblood)]">{error}</p>}

          <AnimatePresence>
            {composing && (
              <ComposeMoment
                books={books}
                onCancel={() => setComposing(false)}
                onSaved={async () => {
                  setComposing(false)
                  await load()
                }}
              />
            )}
          </AnimatePresence>

          <GoalReckoning goals={dueGoals} onResolve={resolveGoal} onReschedule={load} />

          {/* search and date-jump, set as a marginal note rather than a toolbar */}
          <div className="mb-7 flex flex-wrap items-end gap-5">
            <label className="min-w-[10rem] flex-1">
              <span className="small-caps mb-1 block">Look for</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="a word, a name, a place"
                className="ruled-field"
              />
            </label>
            <form onSubmit={jumpToNearest} className="flex items-end gap-2">
              <label>
                <span className="small-caps mb-1 block">Go to</span>
                <input
                  type="date"
                  value={jumpDate}
                  onChange={(e) => setJumpDate(e.target.value)}
                  className="ruled-field"
                />
              </label>
              <button className="quiet-button whitespace-nowrap">Jump</button>
            </form>
          </div>

          {search && (
            <p className="mb-4 text-[13px] italic text-[var(--ink-faint)]">
              {events.length} {events.length === 1 ? 'moment' : 'moments'} matching “{search}”
            </p>
          )}

          {events.length === 0 ? (
            <p className="py-12 text-center text-[14px] italic text-[var(--ink-faint)]">
              {search ? 'Nothing found.' : 'Nothing recorded yet.'}
            </p>
          ) : (
            <ol className="relative pb-4">
              {events.map((event, index) => (
                <Rung
                  key={event.id}
                  ref={(node) => {
                    rungRefs.current[event.id] = node
                  }}
                  event={event}
                  previous={events[index - 1]}
                  index={index}
                  isPresent={event.id === presentId}
                  books={books}
                  expanded={expanded === event.id}
                  onToggle={() =>
                    setExpanded((current) => (current === event.id ? null : event.id))
                  }
                  onChanged={load}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </Panel>
  )
}

/** One rung of the scale: the connector above it, its node, and its card. */
function Rung({
  ref,
  event,
  previous,
  index,
  isPresent,
  books,
  expanded,
  onToggle,
  onChanged,
}: {
  ref: (node: HTMLLIElement | null) => void
  event: TimelineEvent
  previous?: TimelineEvent
  index: number
  isPresent: boolean
  books: Book[]
  expanded: boolean
  onToggle: () => void
  onChanged: () => Promise<void>
}) {
  const [hoveringGap, setHoveringGap] = useState(false)
  const [confirmingRemoval, setConfirmingRemoval] = useState<DOMRect | null>(null)
  const [removing, setRemoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const isFuture = new Date(event.date).getTime() > Date.now()
  const achieved = event.goalStatus === 'ACHIEVED'
  const outlined = (event.isGoal || isFuture) && !achieved

  const year = new Date(event.date).getFullYear()
  const previousYear = previous ? new Date(previous.date).getFullYear() : null
  const showYear = previousYear !== year

  return (
    <>
      {previous && (
        <li
          className="relative ml-[8px] flex h-12 w-px items-center"
          style={{ backgroundColor: 'var(--rule)' }}
          onMouseEnter={() => setHoveringGap(true)}
          onMouseLeave={() => setHoveringGap(false)}
        >
          {/* The elapsed time is the point of normalised spacing — the distance between rungs
              carries no meaning, so the real interval has to be legible without hunting for
              it. Always shown, and it strengthens when the connector is hovered. */}
          <span
            className="absolute left-4 whitespace-nowrap text-[11px] italic transition-colors duration-200"
            style={{ color: hoveringGap ? 'var(--ink-soft)' : 'var(--ink-faint)' }}
          >
            {describeGap(previous.date, event.date)}
          </span>
        </li>
      )}

      <motion.li
        ref={ref}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.32, ease: 'easeOut' }}
        className="relative flex gap-4"
      >
        {/* the node on the spine */}
        <button
          onClick={onToggle}
          aria-label={event.title}
          className="relative mt-[3px] h-[17px] w-[17px] shrink-0 rounded-full transition"
          style={{
            border: `1.5px solid ${isPresent ? 'var(--brass)' : 'var(--ink-soft)'}`,
            backgroundColor: outlined ? 'transparent' : isPresent ? 'var(--brass)' : 'var(--ink)',
            boxShadow: isPresent ? '0 0 0 4px rgba(168,134,60,0.18)' : 'none',
          }}
        >
          {achieved && (
            <span
              className="absolute inset-[3px] rounded-full"
              style={{ border: '1.5px solid var(--paper)' }}
            />
          )}
        </button>

        <div className="min-w-0 flex-1 pb-1">
          {showYear && (
            <p className="small-caps mb-1" style={{ color: 'var(--brass)' }}>
              {year}
            </p>
          )}

          <button onClick={onToggle} className="block w-full text-left">
            <p className="text-[12px] text-[var(--ink-faint)]">{formatEventDate(event.date)}</p>
            <h3
              className="display text-[19px] leading-snug"
              style={{ color: outlined ? 'var(--ink-soft)' : 'var(--ink)' }}
            >
              {achieved ? '✦ ' : event.isGoal ? '◇ ' : ''}
              {event.title}
            </h3>
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.26, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  {editing ? (
                    <EditMoment
                      event={event}
                      books={books}
                      onCancel={() => setEditing(false)}
                      onSaved={async () => {
                        setEditing(false)
                        await onChanged()
                      }}
                    />
                  ) : (
                    <>
                      {event.description && (
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-[var(--ink-soft)]" style={{ overflowWrap: 'anywhere' }}>
                          {event.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {event.book && (
                          <span className="text-[12px] italic text-[var(--ink-faint)]">
                            filed under {event.book.title}
                          </span>
                        )}
                        <button onClick={() => setEditing(true)} className="quiet-button !p-0">
                          Edit
                        </button>
                        <button
                          onClick={(e) =>
                            setConfirmingRemoval(e.currentTarget.getBoundingClientRect())
                          }
                          className="quiet-button !p-0"
                          style={{ color: 'var(--oxblood)' }}
                        >
                          Remove
                        </button>

                        <ConfirmBubble
                          anchor={confirmingRemoval}
                          question={`Remove “${event.title}” from your timeline?`}
                          confirmLabel="Remove it"
                          busy={removing}
                          onDismiss={() => setConfirmingRemoval(null)}
                          onConfirm={async () => {
                            setRemoving(true)
                            try {
                              await timelineApi.remove(event.id)
                              await onChanged()
                            } finally {
                              setRemoving(false)
                              setConfirmingRemoval(null)
                            }
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.li>
    </>
  )
}

/** Goals whose date has arrived, asked about once, at the head of the scale. */
function GoalReckoning({
  goals,
  onResolve,
  onReschedule,
}: {
  goals: TimelineEvent[]
  onResolve: (id: string, status: 'ACHIEVED' | 'NOT_ACHIEVED') => Promise<void>
  onReschedule: () => Promise<void>
}) {
  const [rescheduling, setRescheduling] = useState<string | null>(null)
  const [newDate, setNewDate] = useState('')

  if (goals.length === 0) return null

  return (
    <section
      className="mb-7 border-l-2 pl-4"
      style={{ borderColor: 'var(--brass)' }}
    >
      <p className="small-caps mb-2">
        {goals.length === 1 ? 'A goal has come due' : `${goals.length} goals have come due`}
      </p>
      {goals.map((goal) => (
        <div key={goal.id} className="mb-3 last:mb-0">
          <p className="display text-[17px]">◇ {goal.title}</p>
          <p className="mb-2 text-[12px] text-[var(--ink-faint)]">
            set for {formatEventDate(goal.date)}
          </p>

          {rescheduling === goal.id ? (
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="ruled-field !w-auto"
              />
              <button
                onClick={async () => {
                  if (!newDate) return
                  await timelineApi.update(goal.id, {
                    date: new Date(newDate).toISOString(),
                    goalStatus: 'PENDING',
                  })
                  setRescheduling(null)
                  await onReschedule()
                }}
                className="brass-button"
              >
                Set a new date
              </button>
              <button onClick={() => setRescheduling(null)} className="quiet-button">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] text-[var(--ink-soft)]">Did you manage it?</span>
              <button onClick={() => onResolve(goal.id, 'ACHIEVED')} className="brass-button">
                Yes
              </button>
              <button
                onClick={() => onResolve(goal.id, 'NOT_ACHIEVED')}
                className="quiet-button"
              >
                Not yet
              </button>
              <button onClick={() => setRescheduling(goal.id)} className="quiet-button">
                Move it
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

/** Writing a new moment onto the scale. */
function ComposeMoment({
  books,
  onCancel,
  onSaved,
}: {
  books: Book[]
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [bookId, setBookId] = useState('')
  const [isGoal, setIsGoal] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      await timelineApi.create({
        title: title.trim(),
        date: new Date(date).toISOString(),
        description: description.trim() || undefined,
        bookId: bookId || undefined,
        isGoal,
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      className="mb-7 overflow-hidden"
    >
      <div className="space-y-5 border-l-2 pl-4" style={{ borderColor: 'var(--rule-strong)' }}>
        <Field label="What happened" value={title} onChange={setTitle} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="When" type="date" value={date} onChange={setDate} />
          <label className="block">
            <span className="small-caps mb-1.5 block">Filed under</span>
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="ruled-field"
            >
              <option value="">Nothing in particular</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TextArea label="In your words" value={description} onChange={setDescription} rows={3} />

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={isGoal}
              onChange={(e) => setIsGoal(e.target.checked)}
            />
            This hasn’t happened yet — it’s a goal
          </label>
          <button type="submit" disabled={saving} className="brass-button ml-auto">
            {saving ? 'Writing…' : 'Write it in'}
          </button>
          <button type="button" onClick={onCancel} className="quiet-button">
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  )
}

/** Editing a moment already on the scale. Every field of an event can be revised. */
function EditMoment({
  event,
  books,
  onCancel,
  onSaved,
}: {
  event: TimelineEvent
  books: Book[]
  onCancel: () => void
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(event.date.slice(0, 10))
  const [description, setDescription] = useState(event.description ?? '')
  const [bookId, setBookId] = useState(event.bookId ?? '')
  const [isGoal, setIsGoal] = useState(event.isGoal)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      await timelineApi.update(event.id, {
        title: title.trim(),
        date: new Date(date).toISOString(),
        description: description.trim() || undefined,
        bookId: bookId || undefined,
        isGoal,
      })
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="What happened" value={title} onChange={setTitle} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="When" type="date" value={date} onChange={setDate} />
        <label className="block">
          <span className="small-caps mb-1.5 block">Filed under</span>
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="ruled-field">
            <option value="">Nothing in particular</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextArea label="In your words" value={description} onChange={setDescription} rows={3} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--ink-soft)]">
          <input type="checkbox" checked={isGoal} onChange={(e) => setIsGoal(e.target.checked)} />
          Still a goal
        </label>
        <button type="submit" disabled={saving} className="brass-button ml-auto">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="quiet-button">
          Cancel
        </button>
      </div>
    </form>
  )
}
