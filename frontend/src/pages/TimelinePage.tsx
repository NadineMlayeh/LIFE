import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { GoalPrompt } from '../components/GoalPrompt'
import { PrivacySeal } from '../components/paper/fields'
import { getErrorMessage } from '../services/apiError'
import { booksApi, timelineApi } from '../services/lifeApi'
import type { Book, TimelineEvent } from '../types'
import { describeGap, formatEventDate } from '../utils/dates'

export function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [search, setSearch] = useState('')
  const [jumpDate, setJumpDate] = useState('')
  const eventRefs = useRef<Record<string, HTMLLIElement | null>>({})

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [bookId, setBookId] = useState('')
  const [isGoal, setIsGoal] = useState(false)

  async function load(searchTerm = search) {
    try {
      const [eventList, bookList] = await Promise.all([
        timelineApi.list(searchTerm || undefined),
        booksApi.list(),
      ])
      setEvents(eventList)
      setBooks(bookList)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your timeline.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(search), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    try {
      await timelineApi.create({
        title: title.trim(),
        date: new Date(date).toISOString(),
        description: description.trim() || undefined,
        bookId: bookId || undefined,
        isGoal,
      })
      setTitle('')
      setDate('')
      setDescription('')
      setBookId('')
      setIsGoal(false)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add the event.'))
    }
  }

  async function onDelete(event: TimelineEvent) {
    if (!confirm(`Delete "${event.title}"?`)) return
    try {
      await timelineApi.remove(event.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the event.'))
    }
  }

  // Jumps to the event closest to the chosen date, in either direction, so a date with no
  // event still lands somewhere sensible.
  function onJump(e: FormEvent) {
    e.preventDefault()
    if (!jumpDate || events.length === 0) return

    const target = new Date(jumpDate).getTime()
    const nearest = events.reduce((best, event) =>
      Math.abs(new Date(event.date).getTime() - target) <
      Math.abs(new Date(best.date).getTime() - target)
        ? event
        : best,
    )

    const node = eventRefs.current[nearest.id]
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.classList.add('ring-2', 'ring-amber-400')
    setTimeout(() => node?.classList.remove('ring-2', 'ring-amber-400'), 1600)
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>

  const now = Date.now()
  const dueGoals = events.filter(
    (event) =>
      event.isGoal && event.goalStatus === 'PENDING' && new Date(event.date).getTime() <= now,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Timeline</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Everything in order. Spacing is even — hover a connector to see the real gap.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          {showForm ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <GoalPrompt goals={dueGoals} onResolved={() => load()} />

      <div className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles and descriptions"
          className="min-w-48 flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <form onSubmit={onJump} className="flex gap-2">
          <input
            type="date"
            value={jumpDate}
            onChange={(e) => setJumpDate(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button className="rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
            Jump to date
          </button>
        </form>
      </div>

      {search && (
        <p className="text-sm text-neutral-500">
          {events.length} match{events.length === 1 ? '' : 'es'} for "{search}"
        </p>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What happened?"
              required
              className="min-w-48 flex-1 rounded border border-neutral-300 px-3 py-2"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">No book</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" checked={isGoal} onChange={(e) => setIsGoal(e.target.checked)} />
              This is a future goal
            </label>
            <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">
              Save event
            </button>
          </div>
        </form>
      )}

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
          {search ? 'Nothing matches that search.' : 'Your timeline is empty. Add your first event.'}
        </p>
      ) : (
        <ol className="relative">
          {events.map((event, index) => {
            const previous = events[index - 1]
            const achieved = event.goalStatus === 'ACHIEVED'
            const pendingFuture =
              (event.isGoal || new Date(event.date).getTime() > now) && !achieved

            return (
              <Fragment key={event.id}>
                {previous && (
                  <li
                    title={describeGap(previous.date, event.date)}
                    className="group ml-[7px] flex h-10 w-0.5 cursor-help items-center bg-neutral-200"
                  >
                    <span className="ml-4 hidden text-xs text-neutral-400 group-hover:inline">
                      {describeGap(previous.date, event.date)}
                    </span>
                  </li>
                )}
                <li
                  ref={(node) => {
                    eventRefs.current[event.id] = node
                  }}
                  className="flex gap-4 rounded-lg transition"
                >
                  <span
                    className={`mt-1.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                      pendingFuture ? 'border-neutral-400 bg-white' : 'border-neutral-900 bg-neutral-900'
                    }`}
                  />
                  <div
                    className={`flex-1 rounded-lg border bg-white p-4 ${
                      pendingFuture ? 'border-dashed border-neutral-300' : 'border-neutral-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-neutral-500">{formatEventDate(event.date)}</p>
                        <h2 className="font-medium text-neutral-900">
                          {achieved ? '✅ ' : event.isGoal ? '🎯 ' : ''}
                          {event.title}
                        </h2>
                        {event.isGoal && event.goalStatus === 'NOT_ACHIEVED' && (
                          <p className="text-xs text-neutral-400">Not achieved</p>
                        )}
                        {event.description && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">
                            {event.description}
                          </p>
                        )}
                        {event.book && (
                          <p className="mt-2 text-xs text-neutral-500">
                            {event.book.icon ?? '📘'} {event.book.title}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <PrivacySeal
                          entityType="TIMELINE_EVENT"
                          entityId={event.id}
                          value={event.visibility ?? 'PRIVATE'}
                        />
                        <button
                          onClick={() => onDelete(event)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              </Fragment>
            )
          })}
        </ol>
      )}
    </div>
  )
}
