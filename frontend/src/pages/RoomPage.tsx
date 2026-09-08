import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IdentityPanel } from '../components/paper/IdentityPanel'
import { useAuth } from '../hooks/useAuth'
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
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [visitedCountries, setVisitedCountries] = useState<VisitedCountry[]>([])
  const [featuredPhotoUrl, setFeaturedPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<FocusTarget>('overview')
  const [hovered, setHovered] = useState<string | null>(null)
  // Which document is open on top of the room. The room is never unmounted.
  const [panel, setPanel] = useState<'identity' | null>(null)

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

  useEffect(() => {
    let objectUrl: string | null = null

    Promise.all([booksApi.list(), timelineApi.list(), mapApi.list()])
      .then(async ([bookList, events, countries]) => {
        setBooks(bookList)
        setEventCount(events.length)
        setVisitedCountries(countries)

        // The wall frame shows a real photo. A gallery with nothing in it simply keeps its
        // mounts, so the frames never look broken.
        try {
          const featured = await photosApi.getFeatured()
          if (featured?.id) {
            objectUrl = await photosApi.fetchObjectUrl(featured.id)
            setFeaturedPhotoUrl(objectUrl)
          }
        } catch {
          setFeaturedPhotoUrl(null)
        }
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load your room.')))
      .finally(() => setLoading(false))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

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
      <RoomScene
        books={books}
        eventCount={eventCount}
        visitedCountries={visitedCountries}
        featuredPhotoUrl={featuredPhotoUrl}
        focus={focus}
        onFocus={setFocus}
        onOpenLibrary={() => setTimeout(() => navigate('/books'), 620)}
        onOpenTimeline={() => setTimeout(() => navigate('/timeline'), 620)}
        onOpenMap={() => setTimeout(() => navigate('/dashboard'), 620)}
        onOpenIdentity={() => setTimeout(() => setPanel('identity'), 560)}
        onOpenGallery={() => setTimeout(() => navigate('/gallery'), 620)}
        onHoverObject={setHovered}
        paused={panel !== null}
      />

      {/* Everything readable lives in the DOM. The scene itself carries no text, per the brief. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#8A6B4A]">
              {PHASE_LABEL[lighting.phase]}
            </p>
            <h1 className="mt-1 text-lg font-medium tracking-tight text-[#5C4630]">Your room</h1>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="pointer-events-auto rounded-full border border-[#C9A77C]/60 bg-[#F6EBDA]/80 px-4 py-1.5 text-xs text-[#5C4630] backdrop-blur transition hover:bg-[#F6EBDA]"
          >
            Plain view
          </button>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-xs text-[#8A6B4A]">
            {hovered ? (
              <span className="rounded-full bg-[#F6EBDA]/85 px-3 py-1.5 backdrop-blur">
                {hovered}
              </span>
            ) : (
              <span className="opacity-70">
                {books.length} books · {eventCount} moments
              </span>
            )}
          </p>

          {focus !== 'overview' && (
            <button
              onClick={() => setFocus('overview')}
              className="pointer-events-auto rounded-full border border-[#C9A77C]/60 bg-[#F6EBDA]/80 px-4 py-1.5 text-xs text-[#5C4630] backdrop-blur transition hover:bg-[#F6EBDA]"
            >
              Step back
            </button>
          )}
        </div>
      </div>

      <IdentityPanel
        open={panel === 'identity'}
        userId={user?.id ?? ''}
        onOpenGallery={() => navigate('/gallery')}
        onClose={() => {
          setPanel(null)
          setFocus('overview')
        }}
      />
    </div>
  )
}
