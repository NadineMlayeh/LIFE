import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IdentityPanel } from '../components/paper/IdentityPanel'
import { GalleryPanel } from '../components/paper/GalleryPanel'
import { LibraryPanel } from '../components/paper/LibraryPanel'
import { MailboxPanel, useUnreadLetters } from '../components/paper/MailboxPanel'
import { MapPanel } from '../components/paper/MapPanel'
import { TimelinePanel } from '../components/paper/TimelinePanel'
import { useAuth } from '../hooks/useAuth'
import { RoomTour, hasSeenTour } from '../components/RoomTour'
import { OutsideScene, type OutsideFocus } from '../room/OutsideScene'
import { RoomScene, type FocusTarget } from '../room/RoomScene'
import { lightingForDate } from '../room/timeOfDay'
import { getErrorMessage } from '../services/apiError'
import { booksApi, mapApi, photosApi, timelineApi } from '../services/lifeApi'
import type { Book, VisitedCountry } from '../types'

const PHASE_LABEL: Record<string, string> = {
  morning: 'Morning light',
  day: 'Afternoon',
  sunset: 'Golden hour',
  night: 'Late evening',
}

export function RoomPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([])
  const [featuredPhotoUrl, setFeaturedPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<FocusTarget>('overview')
  const [hovered, setHovered] = useState<string | null>(null)
  /** Which world you are standing in. The window and the front door move you between them. */
  const [where, setWhere] = useState<'inside' | 'outside'>('inside')
  /** Shown once per browser on the first visit, and on demand from the corner afterwards. */
  const [tourOpen, setTourOpen] = useState(false)
  const [outsideFocus, setOutsideFocus] = useState<OutsideFocus>('overview')
  // Which document is open on top of the room. The room is never unmounted.
  const [panel, setPanel] = useState<'identity' | 'timeline' | 'library' | 'gallery' | 'map' | 'mailbox' | null>(null)

  // The 3D room is the shell, never the only way in. Small screens get the plain UI, which is
  // fully capable on its own.
  const [smallScreen, setSmallScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )

  useEffect(() => {
    const onResize = () => setSmallScreen(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // The blob URL behind the wall frame, held so it can be released whenever the frame is
  // re-hung rather than only when the room closes.
  const featuredUrlRef = useRef<string | null>(null)

  /**
   * The wall frame shows a real photograph. A gallery with nothing in it simply keeps its
   * mount, so the frame never looks broken.
   */
  const reloadFeaturedPhoto = useCallback(async () => {
    try {
      const featured = await photosApi.getFeatured()
      const next = featured?.id ? await photosApi.fetchObjectUrl(featured.id) : null
      if (featuredUrlRef.current) URL.revokeObjectURL(featuredUrlRef.current)
      featuredUrlRef.current = next
      setFeaturedPhotoUrl(next)
    } catch {
      setFeaturedPhotoUrl(null)
    }
  }, [])

  useEffect(() => {
    Promise.all([booksApi.list(), timelineApi.list(), mapApi.list()])
      .then(async ([bookList, events, countries]) => {
        setBooks(bookList)
        setEventCount(events.length)
        setVisitedCountries(countries)
        await reloadFeaturedPhoto()
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load your room.')))
      .finally(() => setLoading(false))

    return () => {
      if (featuredUrlRef.current) URL.revokeObjectURL(featuredUrlRef.current)
    }
  }, [reloadFeaturedPhoto])

  const letters = useUnreadLetters(!loading)

  // Offered once the room is actually there to walk around, not while it is still loading.
  useEffect(() => {
    if (!loading && !error && !hasSeenTour()) setTourOpen(true)
  }, [loading, error])

  const lighting = lightingForDate()

  if (smallScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Your room needs a bigger screen</h1>
          <p className="mt-2 text-sm text-neutral-500">
            The room is built for a desktop display. Everything in it is available here too.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
          >
            Continue to LIFE
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EFE2CE]">
        <p className="text-sm tracking-wide text-[#7A5233]">Opening your room...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Go to the plain view
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#EFE2CE]">
      {/* Two worlds, one at a time. Only the one you are standing in is mounted, so the room's
          geometry and lights are not being carried around while you are in the garden. */}
      {where === 'outside' ? (
        <Suspense fallback={<Opening what="Stepping outside…" />}>
          <OutsideScene
            unreadLetters={letters.count}
            onOpenMailbox={() => setTimeout(() => setPanel('mailbox'), 480)}
            onGoInside={() => setTimeout(() => setWhere('inside'), 420)}
            onHoverObject={setHovered}
            focus={outsideFocus}
            paused={panel !== null}
          />
        </Suspense>
      ) : (
      <RoomScene
        books={books}
        eventCount={eventCount}
        visitedCountries={visitedCountries}
        featuredPhotoUrl={featuredPhotoUrl}
        focus={focus}
        onFocus={setFocus}
        onOpenLibrary={() => setTimeout(() => setPanel('library'), 560)}
        onOpenTimeline={() => setTimeout(() => setPanel('timeline'), 560)}
        onOpenMap={() => setTimeout(() => setPanel('map'), 560)}
        onOpenIdentity={() => setTimeout(() => setPanel('identity'), 560)}
        onOpenGallery={() => setTimeout(() => setPanel('gallery'), 560)}
        onGoOutside={() => setTimeout(() => setWhere('outside'), 420)}
        onHoverObject={setHovered}
        paused={panel !== null}
      />
      )}

      {/* Everything readable lives in the DOM. The scene itself carries no text, per the brief. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8A6B4A]">
              {PHASE_LABEL[lighting.phase]}
            </p>
            <h1 className="mt-1 text-lg font-medium tracking-tight text-[#5C4630]">
              {where === 'outside' ? 'Outside your door' : 'Your room'}
            </h1>
          </div>

          {/* Everything lives in the room now, so this corner holds only the tour and the way
              out. */}
          <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setWhere('inside')
              setTourOpen(true)
            }}
            className="pointer-events-auto rounded-full border border-[#C9A77C]/60 bg-[#F6EBDA]/80 px-4 py-1.5 text-xs text-[#5C4630] backdrop-blur transition hover:bg-[#F6EBDA]"
          >
            Show me around
          </button>

          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="pointer-events-auto rounded-full border border-[#C9A77C]/60 bg-[#F6EBDA]/80 px-4 py-1.5 text-xs text-[#5C4630] backdrop-blur transition hover:bg-[#F6EBDA]"
          >
            Leave
          </button>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-xs text-[#8A6B4A]">
            {hovered ? (
              <span className="rounded-full bg-[#F6EBDA]/85 px-3 py-1.5 backdrop-blur">
                {hovered}
              </span>
            ) : (
              <span className="opacity-70">
                {where === 'outside'
                  ? letters.count > 0
                    ? `${letters.count} letter${letters.count === 1 ? '' : 's'} waiting`
                    : 'The flag is down'
                  : `${books.length} books · ${eventCount} moments`}
              </span>
            )}
          </p>

          {where === 'inside' && focus !== 'overview' && (
            <button
              onClick={() => setFocus('overview')}
              className="pointer-events-auto rounded-full border border-[#C9A77C]/60 bg-[#F6EBDA]/80 px-4 py-1.5 text-xs text-[#5C4630] backdrop-blur transition hover:bg-[#F6EBDA]"
            >
              Step back
            </button>
          )}
        </div>
      </div>

      {/* The tour drives the room's own camera, so the object being described is centred and
          the spotlight lands on it without any tracking. */}
      <RoomTour
        open={tourOpen}
        onFocus={setFocus}
        onGo={setWhere}
        onFocusOutside={setOutsideFocus}
        onClose={() => setTourOpen(false)}
      />

      <MailboxPanel
        open={panel === 'mailbox'}
        onUnreadChanged={letters.refresh}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />

      <MapPanel
        open={panel === 'map'}
        userId={user?.id ?? ''}
        onCountriesChanged={() => mapApi.list().then(setVisitedCountries)}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />

      <GalleryPanel
        open={panel === 'gallery'}
        onFeaturedChanged={reloadFeaturedPhoto}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />

      <LibraryPanel
        open={panel === 'library'}
        onShelfChanged={() => booksApi.list().then(setBooks)}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />

      <TimelinePanel
        open={panel === 'timeline'}
        userId={user?.id ?? ''}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />

      <IdentityPanel
        open={panel === 'identity'}
        userId={user?.id ?? ''}
        onOpenGallery={() => setPanel('gallery')}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />
    </div>
  )
}

/** The pause while a world loads. */
function Opening({ what }: { what: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#EFE2CE]">
      <p className="text-sm tracking-wide text-[#7A5233]">{what}</p>
    </div>
  )
}
