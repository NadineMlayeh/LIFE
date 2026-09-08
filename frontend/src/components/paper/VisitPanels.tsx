import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, countryName } from '../../data/countries'
import { CONTINENTS } from '../../room/worldShapes'
import { sharedApi } from '../../services/lifeApi'
import type { SharedView } from '../../types'
import { describeGap, formatEventDate } from '../../utils/dates'
import { PageTurn } from './PageTurn'
import { Panel } from './Panel'

/**
 * What a visitor sees when they open something in someone else's room.
 *
 * These are deliberately **separate, read-only components** rather than the owner's panels
 * with a `readOnly` flag threaded through them. Those panels are built around editing — every
 * field is a live input with its own autosave, every list has a delete beside it. Adding a
 * flag would mean carrying it through several layers and trusting every branch to honour it,
 * and one missed branch is an edit control in a stranger's room.
 *
 * A visitor cannot write anything, so a visitor's panel has nothing to write with. The safety
 * is structural, not conditional.
 *
 * None of this is the privacy boundary, though. That is enforced entirely server-side: the
 * shared payload only ever contains what the owner marked shared, so there is nothing here to
 * leak even if something did render.
 */

/** A quiet line at the head of every visitor panel, so the reading is never mistaken for own. */
function Attribution({ username }: { username: string }) {
  return (
    <p className="small-caps mb-5 text-[var(--ink-faint)]">{username}&rsquo;s, shared with you</p>
  )
}

/** Nothing here — either not shared, or genuinely empty. Said the same way in both cases. */
function Nothing({ what }: { what: string }) {
  return (
    <p className="py-10 text-center text-[13px] italic text-[var(--ink-faint)]">
      {what} is not part of what was shared with you.
    </p>
  )
}

/* -------------------------------------------------------------------------- */

export function VisitLibraryPanel({
  open,
  onClose,
  view,
}: {
  open: boolean
  onClose: () => void
  view: SharedView
}) {
  const [bookId, setBookId] = useState<string | null>(null)
  const [chapterId, setChapterId] = useState<string | null>(null)

  const book = view.books.find((b) => b.id === bookId) ?? null
  const chapter = book?.chapters.find((c) => c.id === chapterId) ?? null

  return (
    <Panel
      open={open}
      onClose={() => {
        setBookId(null)
        setChapterId(null)
        onClose()
      }}
      subtitle={book ? `${book.icon ?? '📕'} ${book.title}` : 'The bookshelf'}
      title={chapter ? chapter.title : book ? book.title : 'Their library'}
      variant="spread"
      steady
      actions={
        chapter ? (
          <button onClick={() => setChapterId(null)} className="quiet-button">
            ← Chapters
          </button>
        ) : book ? (
          <button onClick={() => setBookId(null)} className="quiet-button">
            ← Back to the shelf
          </button>
        ) : null
      }
    >
      <Attribution username={view.owner.username} />

      {view.books.length === 0 ? (
        <Nothing what="Their library" />
      ) : chapter ? (
        <p
          className="mx-auto max-w-2xl text-[15px] leading-[1.85] whitespace-pre-wrap text-[var(--ink)]"
          style={{ overflowWrap: 'anywhere' }}
        >
          {chapter.content?.trim() || (
            <span className="italic text-[var(--ink-faint)]">This chapter is blank.</span>
          )}
        </p>
      ) : book ? (
        <ul className="mx-auto max-w-2xl">
          {book.chapters.map((c, i) => (
            <li key={c.id}>
              <button
                onClick={() => setChapterId(c.id)}
                className="flex w-full min-w-0 items-baseline gap-3 border-b py-3 text-left transition hover:opacity-70"
                style={{ borderColor: 'var(--rule)' }}
              >
                <span className="w-5 shrink-0 text-[12px] text-[var(--ink-faint)]">{i + 1}</span>
                <span className="display shrink-0 text-[17px]">{c.title}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-faint)]">
                  {c.content?.trim() ? c.content.trim().replace(/\s+/g, ' ') : 'blank'}
                </span>
              </button>
            </li>
          ))}
          {book.chapters.length === 0 && (
            <p className="py-8 text-[13px] italic text-[var(--ink-faint)]">
              This volume has no chapters.
            </p>
          )}
        </ul>
      ) : (
        <ul className="mx-auto grid max-w-3xl gap-x-10 md:grid-cols-2">
          {view.books.map((b) => (
            <li key={b.id} className="border-b" style={{ borderColor: 'var(--rule)' }}>
              <button
                onClick={() => setBookId(b.id)}
                className="flex w-full min-w-0 items-baseline gap-2 py-2.5 text-left"
              >
                <span className="text-[15px]">{b.icon ?? '📕'}</span>
                <span className="display truncate text-[16px]">{b.title}</span>
                <span className="ml-auto shrink-0 text-[11px] text-[var(--ink-faint)]">
                  {b.chapters.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

export function VisitTimelinePanel({
  open,
  onClose,
  view,
}: {
  open: boolean
  onClose: () => void
  view: SharedView
}) {
  return (
    <Panel open={open} onClose={onClose} subtitle="The chronology" title="Their timeline" variant="scroll" steady>
      <Attribution username={view.owner.username} />

      {view.events.length === 0 ? (
        <Nothing what="Their timeline" />
      ) : (
        <ol className="relative">
          {view.events.map((event, i) => {
            const previous = view.events[i - 1]
            const gap = previous ? describeGap(previous.date, event.date) : null

            return (
              <li key={event.id}>
                {gap && (
                  <div className="ml-[8px] flex h-12 w-px items-center bg-[var(--rule)]">
                    <span className="ml-3 text-[11px] whitespace-nowrap text-[var(--ink-faint)]">
                      {gap}
                    </span>
                  </div>
                )}

                <div className="flex gap-4">
                  <span
                    className="mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border"
                    style={{
                      borderColor: 'var(--brass)',
                      backgroundColor: event.isGoal ? 'transparent' : 'var(--brass)',
                    }}
                  />
                  <div className="min-w-0 flex-1 pb-3">
                    <p className="small-caps text-[var(--ink-faint)]">
                      {formatEventDate(event.date)}
                      {event.book && ` · filed under ${event.book.title}`}
                    </p>
                    <p className="display text-[17px]">{event.title}</p>
                    {event.description && (
                      <p
                        className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap text-[var(--ink-soft)]"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

const PER_LEAF = 2

export function VisitGalleryPanel({
  open,
  onClose,
  view,
  token,
}: {
  open: boolean
  onClose: () => void
  view: SharedView
  token: string
}) {
  const [leaf, setLeaf] = useState(0)
  const [direction, setDirection] = useState(1)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const urlsRef = useRef(urls)
  urlsRef.current = urls

  const photos = view.photos
  const leafCount = Math.max(1, Math.ceil(photos.length / PER_LEAF))

  // Shared images go through the token route, not the owner's guarded one.
  const wanted = useMemo(
    () => photos.slice(Math.max(0, (leaf - 1) * PER_LEAF), (leaf + 2) * PER_LEAF),
    [photos, leaf],
  )
  const wantedKey = wanted.map((p) => p.id).join(',')

  useEffect(() => {
    const needed = wanted.filter((p) => !(p.id in urlsRef.current)).map((p) => p.id)
    if (needed.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        needed.map(async (id) => {
          try {
            return [id, await sharedApi.photoUrl(token, id)] as const
          } catch {
            return [id, ''] as const
          }
        }),
      )
      if (cancelled) {
        entries.forEach(([, url]) => url && URL.revokeObjectURL(url))
        return
      }
      setUrls((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
    })()
    return () => {
      cancelled = true
    }
  }, [wantedKey, token])

  useEffect(
    () => () => Object.values(urlsRef.current).forEach((u) => u && URL.revokeObjectURL(u)),
    [],
  )

  return (
    <Panel open={open} onClose={onClose} subtitle="The album" title="Their photographs" variant="spread" steady>
      <Attribution username={view.owner.username} />

      {photos.length === 0 ? (
        <Nothing what="Their album" />
      ) : (
        <>
          <PageTurn
            leaf={leaf}
            direction={direction}
            renderPage={(index) => {
              const photo = photos[index]
              if (!photo) return null
              const url = urls[photo.id]
              return (
                <figure className="min-w-0">
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ aspectRatio: '4 / 3', backgroundColor: 'rgba(92,70,48,0.06)' }}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={photo.caption ?? 'A photograph'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[12px] italic text-[var(--ink-faint)]">
                        {url === '' ? 'This print is missing.' : 'Developing…'}
                      </span>
                    )}
                  </div>
                  <figcaption
                    className="mt-3 text-[13px] leading-snug italic text-[var(--ink-soft)]"
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {photo.caption?.trim() || (
                      <span className="text-[var(--ink-faint)]">Uncaptioned</span>
                    )}
                  </figcaption>
                </figure>
              )
            }}
          />

          <div
            className="mt-8 flex items-center justify-center gap-3 border-t pt-4"
            style={{ borderColor: 'var(--rule)' }}
          >
            <button
              onClick={() => {
                setDirection(-1)
                setLeaf((l) => Math.max(0, l - 1))
              }}
              disabled={leaf === 0}
              className="quiet-button disabled:opacity-30"
            >
              ← Previous
            </button>
            <span className="text-[12px] text-[var(--ink-faint)]">
              Leaf {leaf + 1} of {leafCount}
            </span>
            <button
              onClick={() => {
                setDirection(1)
                setLeaf((l) => Math.min(leafCount - 1, l + 1))
              }}
              disabled={leaf >= leafCount - 1}
              className="quiet-button disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */

export function VisitMapPanel({
  open,
  onClose,
  view,
}: {
  open: boolean
  onClose: () => void
  view: SharedView
}) {
  const been = view.visitedCountries.filter((c) => c.status === 'visited')
  const toCome = view.visitedCountries.filter((c) => c.status === 'future')

  return (
    <Panel open={open} onClose={onClose} subtitle="The chart" title="Where they have been" variant="spread" steady>
      <Attribution username={view.owner.username} />

      {!view.mapShared ? (
        <Nothing what="Their chart" />
      ) : (
        <>
          <div
            className="w-full overflow-hidden rounded-[2px] border"
            style={{ borderColor: 'var(--rule)', backgroundColor: 'rgba(92,70,48,0.04)' }}
          >
            <svg viewBox="0 0 1000 500" className="block h-auto w-full" role="img" aria-label="Their chart">
              {CONTINENTS.map((outline, i) => (
                <polygon
                  key={i}
                  points={outline.map(([x, y]) => `${x * 1000},${y * 500}`).join(' ')}
                  fill="rgba(92,70,48,0.13)"
                  stroke="rgba(92,70,48,0.34)"
                  strokeWidth={0.8}
                />
              ))}
              {view.visitedCountries.map((row) => {
                const country = COUNTRIES.find((c) => c.code === row.countryCode)
                if (!country) return null
                return (
                  <circle
                    key={row.countryCode}
                    cx={((country.lon + 180) / 360) * 1000}
                    cy={((90 - country.lat) / 180) * 500}
                    r={5}
                    fill={row.status === 'visited' ? 'var(--oxblood)' : 'transparent'}
                    stroke="var(--oxblood)"
                    strokeWidth={1.6}
                  >
                    <title>{countryName(row.countryCode)}</title>
                  </circle>
                )
              })}
            </svg>
          </div>

          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <Places title={`Been · ${been.length}`} rows={been} />
            <Places title={`Still to come · ${toCome.length}`} rows={toCome} />
          </div>
        </>
      )}
    </Panel>
  )
}

function Places({ title, rows }: { title: string; rows: SharedView['visitedCountries'] }) {
  return (
    <section className="min-w-0">
      <p className="small-caps mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] italic text-[var(--ink-faint)]">Nowhere yet.</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.countryCode} className="border-b py-2" style={{ borderColor: 'var(--rule)' }}>
              <p className="text-[14px]">{countryName(row.countryCode)}</p>
              {row.notes && (
                <p
                  className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-soft)]"
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {row.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */

export function VisitIdentityPanel({
  open,
  onClose,
  view,
}: {
  open: boolean
  onClose: () => void
  view: SharedView
}) {
  const p = view.profile

  return (
    <Panel open={open} onClose={onClose} subtitle="On the record" title={`Who ${view.owner.username} is`}>
      <Attribution username={view.owner.username} />

      {!p ? (
        <Nothing what="Their record" />
      ) : (
        <dl className="space-y-5">
          <Fact label="Full name" value={p.fullName} />
          <Fact label="Birthplace" value={p.birthplace} />
          <Fact label="Nationality" value={p.nationality} />
          <Fact label="Languages" value={p.languages} />
        </dl>
      )}

      {/* Notes are never here, and never will be: they are private by definition, with no
          sharing control at all. */}
    </Panel>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b pb-1.5" style={{ borderColor: 'var(--rule)' }}>
      <dt className="small-caps text-[var(--ink-faint)]">{label}</dt>
      <dd className="text-[16px]" style={{ overflowWrap: 'anywhere' }}>
        {value?.trim() || <span className="italic text-[var(--ink-faint)]">Left blank</span>}
      </dd>
    </div>
  )
}
