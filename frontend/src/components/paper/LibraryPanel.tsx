import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { booksApi, chaptersApi } from '../../services/lifeApi'
import type { Book, BookDetail, Chapter } from '../../types'
import { ConfirmBubble, Hint, PrivacySeal } from './fields'
import { Panel } from './Panel'

/** The shelf physically holds this many. Beyond it, you choose who stands out front. */
export const SHELF_CAPACITY = 16

/**
 * The library, opening as a bound book.
 *
 * Three leaves deep and no deeper: the shelf (every volume you own), a volume's table of
 * chapters, and the chapter itself — one page you write freely. The owner removed the entry
 * level that used to sit between chapter and text; a chapter is not a list of things, it is
 * something you write.
 */
export function LibraryPanel({
  open,
  onClose,
  onShelfChanged,
}: {
  open: boolean
  onClose: () => void
  /** Lets the room restock its shelf when the selection changes. */
  onShelfChanged: () => void
}) {
  const [books, setBooks] = useState<Book[]>([])
  const [openBook, setOpenBook] = useState<BookDetail | null>(null)
  const [openChapterId, setOpenChapterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  async function loadBooks() {
    try {
      setBooks(await booksApi.list(true))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open your library.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || loaded.current) return
    loaded.current = true
    loadBooks()
  }, [open])

  async function takeDown(id: string) {
    try {
      setOpenChapterId(null)
      setOpenBook(await booksApi.get(id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not take that volume down.'))
    }
  }

  async function refreshBook() {
    if (!openBook) return
    try {
      setOpenBook(await booksApi.get(openBook.id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reopen that volume.'))
    }
  }

  /**
   * Writing saves straight to the server, but the open book is patched in place rather than
   * refetched — a refetch mid-sentence replaces the chapter object under the cursor.
   */
  function patchChapterContent(chapterId: string, content: string) {
    setOpenBook((current) =>
      current
        ? {
            ...current,
            chapters: current.chapters.map((c) => (c.id === chapterId ? { ...c, content } : c)),
          }
        : current,
    )
  }

  const openChapter = openBook?.chapters.find((c) => c.id === openChapterId) ?? null
  const onShelfCount = books.filter((b) => b.onShelf && !b.isHidden).length

  return (
    <Panel
      open={open}
      onClose={() => {
        setOpenBook(null)
        setOpenChapterId(null)
        onClose()
      }}
      subtitle={
        openChapter && openBook
          ? `${openBook.icon ?? '📕'} ${openBook.title}`
          : openBook
            ? 'From the shelf'
            : 'The bookshelf'
      }
      title={
        openChapter
          ? openChapter.title
          : openBook
            ? `${openBook.icon ?? '📕'} ${openBook.title}`
            : 'My library'
      }
      variant="spread"
      steady
      actions={
        openChapter ? (
          <button onClick={() => setOpenChapterId(null)} className="quiet-button">
            ← Chapters
          </button>
        ) : openBook ? (
          <button onClick={() => setOpenBook(null)} className="quiet-button">
            ← Back to the shelf
          </button>
        ) : null
      }
    >
      {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>
      ) : error ? (
        <p className="text-sm break-words text-[var(--oxblood)]">{error}</p>
      ) : openBook ? (
        <Volume
          book={openBook}
          openChapter={openChapter}
          onOpenChapter={setOpenChapterId}
          onCloseChapter={() => setOpenChapterId(null)}
          onRefresh={refreshBook}
          onContentSaved={patchChapterContent}
        />
      ) : (
        <Contents
          books={books}
          onShelfCount={onShelfCount}
          onTakeDown={takeDown}
          onChanged={async () => {
            await loadBooks()
            onShelfChanged()
          }}
        />
      )}
    </Panel>
  )
}

/** The contents page: every volume you own, and which of them stand on the shelf. */
function Contents({
  books,
  onShelfCount,
  onTakeDown,
  onChanged,
}: {
  books: Book[]
  onShelfCount: number
  onTakeDown: (id: string) => void
  onChanged: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [busy, setBusy] = useState(false)
  const full = onShelfCount >= SHELF_CAPACITY

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await booksApi.create({ title: title.trim(), icon: icon.trim() || undefined })
      setTitle('')
      setIcon('')
      await onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function toggleShelf(book: Book) {
    // Refuse silently rather than letting the shelf overflow into itself.
    if (!book.onShelf && full) return
    await booksApi.update(book.id, { onShelf: !book.onShelf })
    await onChanged()
  }

  const putAwayBooks = books.filter((b) => !b.onShelf || b.isHidden)

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="min-w-0">
        <p className="small-caps mb-3">
          On the shelf · {onShelfCount} of {SHELF_CAPACITY}
        </p>
        <ul className="space-y-1">
          {books
            .filter((b) => b.onShelf && !b.isHidden)
            .map((book) => (
              <VolumeRow
                key={book.id}
                book={book}
                onOpen={() => onTakeDown(book.id)}
                onToggleShelf={() => toggleShelf(book)}
                onChanged={onChanged}
              />
            ))}
          {onShelfCount === 0 && (
            <li className="py-6 text-[13px] italic text-[var(--ink-faint)]">
              Nothing on the shelf yet.
            </li>
          )}
        </ul>
        {full && (
          <p className="mt-3 text-[12px] italic text-[var(--ink-faint)]">
            The shelf is full. Take something down before adding another.
          </p>
        )}
      </section>

      <section className="min-w-0">
        <p className="small-caps mb-3">Put away</p>
        <ul className="space-y-1">
          {putAwayBooks.map((book) => (
            <VolumeRow
              key={book.id}
              book={book}
              putAway
              onOpen={() => onTakeDown(book.id)}
              onToggleShelf={() => toggleShelf(book)}
              onChanged={onChanged}
            />
          ))}
          {putAwayBooks.length === 0 && (
            <li className="py-6 text-[13px] italic text-[var(--ink-faint)]">
              Everything you have is out on the shelf.
            </li>
          )}
        </ul>

        <form onSubmit={create} className="mt-7 space-y-4">
          <p className="small-caps">Begin a new volume</p>
          <div className="flex gap-3">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="📕"
              className="ruled-field w-14 text-center"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is it about?"
              className="ruled-field min-w-0 flex-1"
            />
          </div>
          <button disabled={busy || !title.trim()} className="brass-button">
            {busy ? 'Binding…' : 'Bind it'}
          </button>
        </form>
      </section>
    </div>
  )
}

function VolumeRow({
  book,
  putAway,
  onOpen,
  onToggleShelf,
  onChanged,
}: {
  book: Book
  putAway?: boolean
  onOpen: () => void
  onToggleShelf: () => void
  onChanged: () => Promise<void>
}) {
  const [hovered, setHovered] = useState(false)
  const [confirming, setConfirming] = useState<DOMRect | null>(null)
  const [deleting, setDeleting] = useState(false)

  return (
    <li
      className="group flex items-center gap-3 border-b py-2"
      style={{ borderColor: 'var(--rule)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
        <span className="text-[15px]">{book.icon ?? '📕'}</span>
        <span className="display truncate text-[16px]">{book.title}</span>
        <span className="ml-auto shrink-0 text-[11px] text-[var(--ink-faint)]">
          {book._count?.chapters ?? 0}
        </span>
      </button>

      <motion.span
        // Kept mounted while the confirmation is open, so the bubble's anchor cannot vanish
        // out from under it when the pointer leaves the row to answer the question.
        animate={{ opacity: hovered || confirming ? 1 : 0 }}
        className="flex shrink-0 items-center gap-2"
      >
        <PrivacySeal entityType="BOOK" entityId={book.id} value={book.visibility ?? 'PRIVATE'} />

        <Hint
          text={
            putAway
              ? 'Stand this volume on the shelf in your room, where you can reach it.'
              : 'Keep the volume, but take it off the shelf in your room. Nothing inside is lost.'
          }
        >
          <button onClick={onToggleShelf} className="quiet-button !p-0">
            {putAway ? 'Shelve' : 'Put away'}
          </button>
        </Hint>

        <Hint text="Destroy this volume and everything written in it. This cannot be undone.">
          <button
            onClick={(e) => setConfirming(e.currentTarget.getBoundingClientRect())}
            className="quiet-button !p-0"
            style={{ color: 'var(--oxblood)' }}
          >
            Delete
          </button>
        </Hint>
      </motion.span>

      <ConfirmBubble
        anchor={confirming}
        question={`Delete “${book.title}” and everything written in it?`}
        confirmLabel="Delete it"
        busy={deleting}
        onDismiss={() => setConfirming(null)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await booksApi.remove(book.id)
            await onChanged()
          } finally {
            setDeleting(false)
            setConfirming(null)
          }
        }}
      />
    </li>
  )
}

/**
 * An open volume. Its first leaf is the table of chapters; choosing one turns the page to the
 * chapter itself. Only one leaf is on screen at a time — the old side-by-side split gave the
 * list of names as much room as the writing, which is not how a book is read.
 */
function Volume({
  book,
  openChapter,
  onOpenChapter,
  onCloseChapter,
  onRefresh,
  onContentSaved,
}: {
  book: BookDetail
  openChapter: Chapter | null
  onOpenChapter: (id: string) => void
  onCloseChapter: () => void
  onRefresh: () => Promise<void>
  onContentSaved: (chapterId: string, content: string) => void
}) {
  // No page turn here, deliberately. A chapter is one continuous block of writing, not one
  // side of a leaf — flipping it like a book page claims a two-page spread this layout does
  // not have, and the gesture reads as decoration rather than as paper. A quiet settle is
  // honest about what is actually happening: one view replacing another.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={openChapter?.id ?? '__chapters'}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {openChapter ? (
          <ChapterPage
            chapter={openChapter}
            onRefresh={onRefresh}
            onContentSaved={onContentSaved}
            onDeleted={async () => {
              onCloseChapter()
              await onRefresh()
            }}
          />
        ) : (
          <ChapterList book={book} onOpenChapter={onOpenChapter} onRefresh={onRefresh} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

/** The volume's first leaf: every chapter by name, and the means to begin another. */
function ChapterList({
  book,
  onOpenChapter,
  onRefresh,
}: {
  book: BookDetail
  onOpenChapter: (id: string) => void
  onRefresh: () => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  async function addChapter(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      const created = await chaptersApi.create({ bookId: book.id, title: title.trim() })
      setTitle('')
      await onRefresh()
      onOpenChapter(created.id)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="small-caps mb-4">Chapters</p>

      <ul>
        {book.chapters.map((chapter, index) => (
          <li key={chapter.id}>
            <button
              onClick={() => onOpenChapter(chapter.id)}
              className="flex w-full min-w-0 items-baseline gap-3 border-b py-3 text-left transition hover:opacity-70"
              style={{ borderColor: 'var(--rule)' }}
            >
              <span className="w-5 shrink-0 text-[12px] text-[var(--ink-faint)]">{index + 1}</span>
              <span className="display shrink-0 text-[17px]">{chapter.title}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-faint)]">
                {chapter.content?.trim()
                  ? chapter.content.trim().replace(/\s+/g, ' ')
                  : 'blank'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {book.chapters.length === 0 && (
        <p className="py-8 text-[13px] italic text-[var(--ink-faint)]">
          This volume has no chapters yet. Name the first one below.
        </p>
      )}

      <form onSubmit={addChapter} className="mt-8 flex items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="small-caps mb-1 block">New chapter</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Jobs, Trips, People…"
            className="ruled-field w-full"
          />
        </label>
        <button disabled={busy || !title.trim()} className="brass-button">
          {busy ? 'Adding…' : 'Add chapter'}
        </button>
      </form>
    </div>
  )
}

/**
 * A chapter, which is simply a page you write on. It saves itself a moment after you stop
 * typing, so there is no "submit" between having a thought and keeping it.
 */
function ChapterPage({
  chapter,
  onRefresh,
  onContentSaved,
  onDeleted,
}: {
  chapter: Chapter
  onRefresh: () => Promise<void>
  onContentSaved: (chapterId: string, content: string) => void
  onDeleted: () => Promise<void>
}) {
  const [text, setText] = useState(chapter.content ?? '')
  const [title, setTitle] = useState(chapter.title)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [confirming, setConfirming] = useState<DOMRect | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Nothing has been typed yet, so the first render must not write an empty page back.
  const touched = useRef(false)

  useEffect(() => {
    if (!touched.current) return
    setStatus('saving')
    const timer = setTimeout(async () => {
      try {
        await chaptersApi.update(chapter.id, { content: text })
        onContentSaved(chapter.id, text)
        setStatus('saved')
      } catch {
        setStatus('failed')
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [text, chapter.id])

  async function renameChapter() {
    const next = title.trim()
    if (!next || next === chapter.title) {
      setTitle(chapter.title)
      return
    }
    await chaptersApi.update(chapter.id, { title: next })
    await onRefresh()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={renameChapter}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Chapter title"
          className="display min-w-0 flex-1 border-b border-transparent bg-transparent text-[19px] outline-none transition focus:border-[var(--rule)]"
        />

        <span className="shrink-0 text-[11px] text-[var(--ink-faint)]">
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved'
              : status === 'failed'
                ? 'Not saved'
                : ''}
        </span>

        <Hint text="Remove this chapter and everything written on it. This cannot be undone.">
          <button
            onClick={(e) => setConfirming(e.currentTarget.getBoundingClientRect())}
            className="quiet-button !p-0"
            style={{ color: 'var(--oxblood)' }}
          >
            Delete chapter
          </button>
        </Hint>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          touched.current = true
          setText(e.target.value)
        }}
        placeholder="Write freely…"
        rows={16}
        className="w-full resize-y bg-transparent text-[15px] leading-[1.85] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] placeholder:italic"
        // A long unbroken run of characters used to push the page sideways rather than wrap.
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      />

      <ConfirmBubble
        anchor={confirming}
        question={`Delete the chapter “${chapter.title}” and everything on it?`}
        confirmLabel="Delete it"
        busy={deleting}
        onDismiss={() => setConfirming(null)}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await chaptersApi.remove(chapter.id)
            await onDeleted()
          } finally {
            setDeleting(false)
            setConfirming(null)
          }
        }}
      />
    </div>
  )
}
