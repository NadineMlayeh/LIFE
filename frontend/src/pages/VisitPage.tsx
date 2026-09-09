import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  VisitGalleryPanel,
  VisitIdentityPanel,
  VisitLibraryPanel,
  VisitMapPanel,
  VisitTimelinePanel,
} from '../components/paper/VisitPanels'
import type { FocusTarget } from '../room/RoomScene'
import { getErrorMessage } from '../services/apiError'
import { sharedApi } from '../services/lifeApi'
import type { Book, SharedView } from '../types'

const RoomScene = lazy(() => import('../room/RoomScene').then((m) => ({ default: m.RoomScene })))

/**
 * Visiting someone's room.
 *
 * A share link opens the **room**, not a summary of it — the point of the whole project is
 * that a life is a place you walk into, and handing a visitor a list of headings would throw
 * that away at the one moment someone else is looking. So a visitor gets the same room, the
 * same objects and the same documents, with two differences: nothing can be edited, and
 * objects the owner did not share do not open.
 *
 * Privacy is not decided here. The shared payload contains only what the owner marked shared,
 * so there is nothing in this component's hands to leak — what it does not render, it never
 * received. This page's job is to render a room, not to keep a secret.
 */
export function VisitPage() {
  const { token = '' } = useParams()
  const [view, setView] = useState<SharedView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<FocusTarget>('overview')
  const [hovered, setHovered] = useState<string | null>(null)
  const [panel, setPanel] = useState<
    'identity' | 'timeline' | 'library' | 'gallery' | 'map' | null
  >(null)
  const [featuredUrl, setFeaturedUrl] = useState<string | null>(null)
  const featuredRef = useRef<string | null>(null)

  /**
   * A shared link is the one address that gets sent to people, and most of them will open it
   * on a phone. The room genuinely wants a wide window and a pointer, so the warning stays —
   * but it must not be the end of the road: a visitor who has followed a link and been told
   * only "not here" has been shown nothing at all, and has no reason to come back on a laptop.
   */
  const [smallScreen, setSmallScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 900,
  )
  const [ignoreScreenSize, setIgnoreScreenSize] = useState(false)
  useEffect(() => {
    const onResize = () => setSmallScreen(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let cancelled = false
    sharedApi
      .view(token)
      .then(async (data) => {
        if (cancelled) return
        setView(data)
        if (data.featuredPhoto) {
          try {
            const url = await sharedApi.photoUrl(token, data.featuredPhoto.id)
            if (cancelled) {
              URL.revokeObjectURL(url)
              return
            }
            featuredRef.current = url
            setFeaturedUrl(url)
          } catch {
            setFeaturedUrl(null)
          }
        }
      })
      .catch((err) => setError(getErrorMessage(err, 'This link is not valid, or has been revoked.')))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
      if (featuredRef.current) URL.revokeObjectURL(featuredRef.current)
    }
  }, [token])

  /**
   * The bookshelf renders whatever it is given. A visitor's books carry none of the owner's
   * housekeeping — nothing is hidden or off the shelf, because anything in this list is
   * already something the owner chose to share.
   */
  const books: Book[] = useMemo(
    () =>
      (view?.books ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        icon: b.icon,
        isCustom: true,
        isHidden: false,
        onShelf: true,
        _count: { chapters: b.chapters.length },
      })),
    [view],
  )

  if (loading) {
    return (
      <Centred>
        <p className="text-sm tracking-wide text-[#7A5233]">Opening their room…</p>
      </Centred>
    )
  }

  if (error || !view) {
    return (
      <Centred>
        <div className="max-w-sm text-center">
          <h1 className="text-lg text-[#5C4630]">This door does not open</h1>
          <p className="mt-2 text-sm text-[#8A6B4A]">{error}</p>
          <Link
            to="/login"
            className="mt-5 inline-block rounded-full border border-[#C9A77C]/60 px-4 py-1.5 text-xs text-[#5C4630]"
          >
            Go to your own room
          </Link>
        </div>
      </Centred>
    )
  }

  if (smallScreen && !ignoreScreenSize) {
    return (
      <Centred>
        <div className="max-w-sm text-center">
          <h1 className="text-lg text-[#5C4630]">{view.owner.username}&rsquo;s room</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#8A6B4A]">
            A room needs a wider window than this. On a laptop you can look around it properly.
          </p>
          <button
            type="button"
            onClick={() => setIgnoreScreenSize(true)}
            className="mt-5 inline-block rounded-full border border-[#C9A77C]/60 px-4 py-1.5 text-xs text-[#5C4630] transition-colors hover:bg-[#C9A77C]/20"
          >
            Look anyway
          </button>
        </div>
      </Centred>
    )
  }

  // An object only opens if there is something behind it to see. Everything else is furniture.
  const has = {
    library: view.books.length > 0,
    timeline: view.events.length > 0,
    gallery: view.photos.length > 0,
    map: view.mapShared,
    identity: view.profile !== null,
  }

  const openIf = (ok: boolean, which: typeof panel) => () => {
    if (ok) setTimeout(() => setPanel(which), 560)
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#EFE2CE]">
      <Suspense
        fallback={
          <Centred>
            <p className="text-sm tracking-wide text-[#7A5233]">Opening their room…</p>
          </Centred>
        }
      >
        <RoomScene
          books={books}
          eventCount={view.events.length}
          visitedCountries={view.visitedCountries}
          featuredPhotoUrl={featuredUrl}
          focus={focus}
          onFocus={setFocus}
          onOpenLibrary={openIf(has.library, 'library')}
          onOpenTimeline={openIf(has.timeline, 'timeline')}
          onOpenMap={openIf(has.map, 'map')}
          onOpenIdentity={openIf(has.identity, 'identity')}
          onOpenGallery={openIf(has.gallery, 'gallery')}
          // A visitor stays in the room. Someone else's garden and their post are not part of
          // what was shared, and the window is not a door you get to use in another life.
          onGoOutside={() => {}}
          onHoverObject={setHovered}
          paused={panel !== null}
        />
      </Suspense>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <div className="flex w-full items-start justify-between">
          <div>
            <p className="text-[11px] tracking-[0.2em] text-[#8A6B4A] uppercase">Visiting</p>
            <h1 className="mt-1 text-lg tracking-tight text-[#5C4630]">
              {view.owner.username}&rsquo;s room
            </h1>
          </div>

          {/* The way home. Without it the only way out of someone else's room was the browser's
              back button, which is not a door. */}
          <Link
            to="/room"
            className="pointer-events-auto rounded-full border border-[#C9A77C]/60 bg-[#F6EBDA]/80 px-4 py-1.5 text-xs text-[#5C4630] backdrop-blur transition hover:bg-[#F6EBDA]"
          >
            Back to my room
          </Link>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-xs text-[#8A6B4A]">
            {hovered ? (
              <span className="rounded-full bg-[#F6EBDA]/85 px-3 py-1.5 backdrop-blur">
                {hovered}
              </span>
            ) : (
              <span className="opacity-70">
                Only what {view.owner.username} shared will open.
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

      <VisitLibraryPanel open={panel === 'library'} view={view} onClose={close(setPanel, setFocus)} />
      <VisitTimelinePanel open={panel === 'timeline'} view={view} onClose={close(setPanel, setFocus)} />
      <VisitGalleryPanel
        open={panel === 'gallery'}
        view={view}
        token={token}
        onClose={close(setPanel, setFocus)}
      />
      <VisitMapPanel open={panel === 'map'} view={view} onClose={close(setPanel, setFocus)} />
      <VisitIdentityPanel open={panel === 'identity'} view={view} onClose={close(setPanel, setFocus)} />
    </div>
  )
}

function close(
  setPanel: (v: null) => void,
  setFocus: (v: FocusTarget) => void,
): () => void {
  return () => {
    setPanel(null)
    setFocus('overview')
  }
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EFE2CE] px-6">{children}</div>
  )
}
