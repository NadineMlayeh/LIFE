import { useEffect, useMemo, useRef, useState } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { photosApi } from '../../services/lifeApi'
import { compressImage } from '../../utils/compressImage'
import type { Photo } from '../../types'
import { ConfirmBubble, Hint, PrivacySeal } from './fields'
import { PageTurn } from './PageTurn'
import { Panel } from './Panel'

/**
 * Two prints to a leaf, the way a photograph album is actually laid out. A grid of many small
 * thumbnails is a file browser; an album gives each picture room and makes you turn the page
 * to see the next one.
 */
const PER_LEAF = 2

/**
 * A caption that writes itself back shortly after you stop typing.
 *
 * Shared by the print on the leaf and the enlarged plate, so a caption behaves identically
 * wherever you happen to be looking at it. The saved value is pushed back into the album's
 * list rather than refetched, so nothing moves under the cursor mid-sentence.
 */
function useCaptionAutosave(photo: Photo, onSaved: (id: string, caption: string) => void) {
  const [caption, setCaption] = useState(photo.caption ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const touched = useRef(false)

  useEffect(() => {
    if (!touched.current) return
    setStatus('saving')
    const timer = setTimeout(async () => {
      try {
        await photosApi.update(photo.id, { caption })
        onSaved(photo.id, caption)
        setStatus('saved')
      } catch {
        setStatus('failed')
      }
    }, 800)
    return () => clearTimeout(timer)
    // onSaved is stable; re-running on it would restart the timer on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caption, photo.id])

  function edit(next: string) {
    touched.current = true
    setCaption(next)
  }

  return { caption, edit, status }
}

/** The one-word note under a caption saying whether it reached the server. */
function SaveMark({ status }: { status: 'idle' | 'saving' | 'saved' | 'failed' }) {
  if (status === 'idle') return null
  return (
    <span
      className="shrink-0 text-[11px]"
      style={{ color: status === 'failed' ? 'var(--oxblood)' : 'var(--ink-faint)' }}
    >
      {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Not saved'}
    </span>
  )
}

/**
 * The gallery as a bound album you leaf through.
 *
 * Prints are held by paper corners on an ivory leaf, captioned underneath. One photograph can
 * be hung in the room's wall frame, and each carries its own privacy — the album is the only
 * place images live, since books were deliberately kept to writing alone.
 */
export function GalleryPanel({
  open,
  onClose,
  onFeaturedChanged,
}: {
  open: boolean
  onClose: () => void
  /** Lets the room re-hang its wall frame when a different photograph is chosen. */
  onFeaturedChanged: () => void
}) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [leaf, setLeaf] = useState(0)
  const [direction, setDirection] = useState(1)
  const [plateId, setPlateId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  // Object URLs, kept for the life of the panel so leafing back and forth does not refetch.
  const [urls, setUrls] = useState<Record<string, string>>({})
  const urlsRef = useRef(urls)
  urlsRef.current = urls

  async function loadPhotos() {
    try {
      setPhotos(await photosApi.list())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open your album.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || loaded.current) return
    loaded.current = true
    loadPhotos()
  }, [open])

  // Every blob URL this panel made is released when it goes away, or they accumulate for as
  // long as the room stays open.
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach((url) => url && URL.revokeObjectURL(url))
    }
  }, [])

  const leafCount = Math.max(1, Math.ceil(photos.length / PER_LEAF))
  const currentLeaf = Math.min(leaf, leafCount - 1)
  const plate = photos.find((p) => p.id === plateId) ?? null

  // The neighbouring leaves are loaded too, not just the open one: during a turn the sheet in
  // the air shows a page from the next spread, and an un-loaded one would turn over to reveal
  // "Developing…" instead of a photograph.
  const visible = useMemo(() => {
    if (plate) return [plate]
    const from = Math.max(0, (currentLeaf - 1) * PER_LEAF)
    const to = (currentLeaf + 2) * PER_LEAF
    return photos.slice(from, to)
  }, [photos, currentLeaf, plate])
  const visibleKey = visible.map((p) => p.id).join(',')

  /**
   * The image route is guarded, so an <img src> cannot reach it. Each print is fetched with
   * the auth header and wrapped in an object URL, which is what keeps private photographs
   * genuinely private rather than merely unlisted.
   */
  useEffect(() => {
    const needed = visible.filter((p) => !(p.id in urlsRef.current)).map((p) => p.id)
    if (needed.length === 0) return

    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        needed.map(async (id) => {
          try {
            return [id, await photosApi.fetchObjectUrl(id)] as const
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
  }, [visibleKey])

  function turn(to: number) {
    setDirection(to > currentLeaf ? 1 : -1)
    setLeaf(Math.max(0, Math.min(leafCount - 1, to)))
  }

  function patchCaption(id: string, caption: string) {
    setPhotos((current) => current.map((p) => (p.id === id ? { ...p, caption } : p)))
  }

  async function refreshAfterChange(nextPlate?: string | null) {
    const fresh = await photosApi.list()

    // A deleted photograph's blob URL would otherwise sit in memory until the panel closed,
    // holding the whole image. Anything no longer in the album is released here.
    const alive = new Set(fresh.map((p) => p.id))
    setUrls((current) => {
      const kept: Record<string, string> = {}
      for (const [id, url] of Object.entries(current)) {
        if (alive.has(id)) kept[id] = url
        else if (url) URL.revokeObjectURL(url)
      }
      return kept
    })

    setPhotos(fresh)
    if (nextPlate !== undefined) setPlateId(nextPlate)
  }

  return (
    <Panel
      open={open}
      onClose={() => {
        setPlateId(null)
        onClose()
      }}
      subtitle={plate ? 'From the album' : 'The album'}
      title={plate ? (plate.caption?.trim() || 'A photograph') : 'My photographs'}
      variant="spread"
      steady
      actions={
        plate ? (
          <button onClick={() => setPlateId(null)} className="quiet-button">
            ← Back to the album
          </button>
        ) : null
      }
    >
      {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>
      ) : error ? (
        <p className="text-sm break-words text-[var(--oxblood)]">{error}</p>
      ) : plate ? (
        <Plate
          photo={plate}
          url={urls[plate.id]}
          onChanged={refreshAfterChange}
          onCaptionSaved={patchCaption}
          onFeaturedChanged={onFeaturedChanged}
          onDeleted={async () => {
            setPlateId(null)
            await refreshAfterChange(null)
          }}
        />
      ) : (
        <Album
          photos={photos}
          urls={urls}
          leaf={currentLeaf}
          leafCount={leafCount}
          direction={direction}
          onTurn={turn}
          onOpenPlate={setPlateId}
          onCaptionSaved={patchCaption}
          onUploaded={async (added) => {
            const fresh = await photosApi.list()
            setPhotos(fresh)
            // Land on the leaf holding the last picture just added, so it is actually seen.
            if (added > 0) {
              setDirection(1)
              setLeaf(Math.max(0, Math.ceil(fresh.length / PER_LEAF) - 1))
            }
          }}
          onError={setError}
        />
      )}
    </Panel>
  )
}

/** The open album: one leaf at a time, turning as you move through it. */
function Album({
  photos,
  urls,
  leaf,
  leafCount,
  direction,
  onTurn,
  onOpenPlate,
  onCaptionSaved,
  onUploaded,
  onError,
}: {
  photos: Photo[]
  urls: Record<string, string>
  leaf: number
  leafCount: number
  direction: number
  onTurn: (to: number) => void
  onOpenPlate: (id: string) => void
  onCaptionSaved: (id: string, caption: string) => void
  onUploaded: (added: number) => Promise<void>
  onError: (message: string) => void
}) {
  // Pages are drawn by index rather than pre-sliced, because during a turn the spread shows
  // pages from two different leaves at once — the half being left behind and the half being
  // uncovered.
  function renderPage(pageIndex: number) {
    const photo = photos[pageIndex]
    if (!photo) {
      // A book ends on a blank leaf rather than a gap, and the very first one says so.
      return photos.length === 0 && pageIndex === 0 ? (
        <p className="py-12 text-center text-[13px] italic text-[var(--ink-faint)]">
          The album is empty. Mount your first photograph below.
        </p>
      ) : null
    }
    return (
      <Print
        photo={photo}
        url={urls[photo.id]}
        onOpen={() => onOpenPlate(photo.id)}
        onCaptionSaved={onCaptionSaved}
      />
    )
  }

  return (
    <div>
      <PageTurn leaf={leaf} direction={direction} renderPage={renderPage} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t pt-4"
        style={{ borderColor: 'var(--rule)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onTurn(leaf - 1)}
            disabled={leaf === 0}
            className="quiet-button disabled:opacity-30"
          >
            ← Previous
          </button>
          <span className="text-[12px] text-[var(--ink-faint)]">
            Leaf {leaf + 1} of {leafCount}
          </span>
          <button
            onClick={() => onTurn(leaf + 1)}
            disabled={leaf >= leafCount - 1}
            className="quiet-button disabled:opacity-30"
          >
            Next →
          </button>
        </div>

        <Mount onUploaded={onUploaded} onError={onError} />
      </div>
    </div>
  )
}

/** A single print, held to the leaf by its corners. */
function Print({
  photo,
  url,
  onOpen,
  onCaptionSaved,
}: {
  photo: Photo
  url?: string
  onOpen: () => void
  onCaptionSaved: (id: string, caption: string) => void
}) {
  const { caption, edit, status } = useCaptionAutosave(photo, onCaptionSaved)

  return (
    <figure className="min-w-0">
      <button
        onClick={onOpen}
        className="group relative block w-full"
        aria-label={photo.caption?.trim() || photo.originalName}
      >
        {/* A height tied to the window rather than an aspect ratio tied to the width. On a wide
            panel a 4:3 print grew taller than the leaf and pushed the whole album into a
            scroll; capping the height keeps a spread on one screen whatever the shape of the
            window. */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 'min(30vh, 17rem)', backgroundColor: 'rgba(92,70,48,0.06)' }}
        >
          {url ? (
            <img
              src={url}
              alt={photo.caption?.trim() || photo.originalName}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            />
          ) : url === '' ? (
            <span className="absolute inset-0 flex items-center justify-center text-[12px] italic text-[var(--ink-faint)]">
              This print is missing.
            </span>
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[12px] italic text-[var(--ink-faint)]">
              Developing…
            </span>
          )}
          <PhotoCorners />
        </div>
      </button>

      {/* The caption is always a field, never a label you must first click "edit" on: one
          click lands the cursor in it and you are writing. It only looks like a field once
          you are actually in it. */}
      <figcaption className="mt-3 flex items-start gap-2">
        <textarea
          value={caption}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          placeholder="Uncaptioned"
          rows={2}
          aria-label="Caption"
          className="min-w-0 flex-1 resize-none border-b border-transparent bg-transparent text-[13px] leading-snug italic text-[var(--ink-soft)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--rule)]"
          style={{ overflowWrap: 'anywhere' }}
        />
        <div className="flex shrink-0 flex-col items-end gap-1">
          {photo.isFeatured && <span className="small-caps text-[var(--brass)]">In the frame</span>}
          <SaveMark status={status} />
        </div>
      </figcaption>
    </figure>
  )
}

/** The four paper corners that hold a print to the page. */
function PhotoCorners() {
  const corners = [
    { top: 0, left: 0, angle: 135 },
    { top: 0, right: 0, angle: 225 },
    { bottom: 0, right: 0, angle: 315 },
    { bottom: 0, left: 0, angle: 45 },
  ]
  return (
    <>
      {corners.map((corner, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            ...corner,
            width: 22,
            height: 22,
            background: `linear-gradient(${corner.angle}deg, rgba(247,240,226,0.92) 50%, transparent 50%)`,
          }}
        />
      ))}
    </>
  )
}

/** Mounting new photographs into the album. */
function Mount({
  onUploaded,
  onError,
}: {
  onUploaded: (added: number) => Promise<void>
  onError: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length === 0) return
          setBusy(true)
          let added = 0
          try {
            for (const file of files) {
              // Shrunk in the browser, so a full-size original never reaches the server. On a
              // free storage tier the difference between a 6 MB phone photograph and a 300 KB
              // one is the difference between an album of thirty and an album of six hundred.
              await photosApi.upload(await compressImage(file))
              added += 1
            }
          } catch (err) {
            onError(getErrorMessage(err, 'That photograph could not be mounted.'))
          } finally {
            // Clearing the input lets the same file be chosen again after a failure.
            e.target.value = ''
            setBusy(false)
            await onUploaded(added)
          }
        }}
      />
      <Hint text="JPEG, PNG, WebP or GIF, up to 5 MB each. You can choose several at once.">
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="brass-button"
        >
          {busy ? 'Mounting…' : 'Add photographs'}
        </button>
      </Hint>
    </>
  )
}

/** One photograph, enlarged, with everything you can decide about it. */
function Plate({
  photo,
  url,
  onChanged,
  onCaptionSaved,
  onFeaturedChanged,
  onDeleted,
}: {
  photo: Photo
  url?: string
  onChanged: (nextPlate?: string | null) => Promise<void>
  onCaptionSaved: (id: string, caption: string) => void
  onFeaturedChanged: () => void
  onDeleted: () => Promise<void>
}) {
  const { caption, edit, status } = useCaptionAutosave(photo, onCaptionSaved)
  const [confirming, setConfirming] = useState<DOMRect | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [hanging, setHanging] = useState(false)

  async function hangInFrame() {
    setHanging(true)
    try {
      await photosApi.update(photo.id, { isFeatured: true })
      await onChanged(photo.id)
      onFeaturedChanged()
    } finally {
      setHanging(false)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '4 / 3', backgroundColor: 'rgba(92,70,48,0.06)' }}
      >
        {url ? (
          <img
            src={url}
            alt={photo.caption?.trim() || photo.originalName}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[12px] italic text-[var(--ink-faint)]">
            {url === '' ? 'This print is missing.' : 'Developing…'}
          </span>
        )}
        <PhotoCorners />
      </div>

      <div className="min-w-0">
        <label className="block">
          <span className="small-caps mb-1.5 block">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => edit(e.target.value)}
            placeholder="Where, when, who…"
            rows={3}
            className="ruled-field w-full resize-none"
            style={{ overflowWrap: 'anywhere' }}
          />
        </label>
        <p className="mt-1 flex h-4 justify-end">
          <SaveMark status={status} />
        </p>

        <dl className="mt-5 space-y-1.5 text-[12px] text-[var(--ink-faint)]">
          <div className="flex gap-2">
            <dt className="small-caps">Taken in</dt>
            <dd>{new Date(photo.createdAt).toLocaleDateString()}</dd>
          </div>
          <div className="flex min-w-0 gap-2">
            <dt className="small-caps shrink-0">File</dt>
            <dd className="min-w-0 truncate">{photo.originalName}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="small-caps">Who may see it</span>
            <PrivacySeal entityType="PHOTO" entityId={photo.id} value={photo.visibility} />
          </div>

          {photo.isFeatured ? (
            <p className="text-[12px] italic text-[var(--ink-soft)]">
              This one hangs in your room's frame.
            </p>
          ) : (
            <Hint text="Hang this photograph in the frame on your room's wall. It replaces whichever is there now.">
              <button onClick={hangInFrame} disabled={hanging} className="brass-button">
                {hanging ? 'Hanging…' : 'Hang it in the frame'}
              </button>
            </Hint>
          )}

          <div>
            <Hint text="Remove this photograph from the album for good. This cannot be undone.">
              <button
                onClick={(e) => setConfirming(e.currentTarget.getBoundingClientRect())}
                className="quiet-button !p-0"
                style={{ color: 'var(--oxblood)' }}
              >
                Remove from the album
              </button>
            </Hint>
          </div>
        </div>
      </div>

      <ConfirmBubble
        anchor={confirming}
        question="Remove this photograph from the album?"
        confirmLabel="Remove it"
        busy={deleting}
        onDismiss={() => setConfirming(null)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            const wasFeatured = photo.isFeatured
            await photosApi.remove(photo.id)
            await onDeleted()
            // The wall frame was showing this one, so the room has to re-hang.
            if (wasFeatured) onFeaturedChanged()
          } finally {
            setDeleting(false)
            setConfirming(null)
          }
        }}
      />
    </div>
  )
}
