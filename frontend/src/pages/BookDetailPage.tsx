import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getErrorMessage } from '../services/apiError'
import { booksApi, chaptersApi, itemsApi } from '../services/lifeApi'
import type { BookDetail, Chapter, Item, ItemType } from '../types'

const ITEM_TYPES: ItemType[] = [
  'MEMORY',
  'PERSON',
  'PLACE',
  'EVENT',
  'ACHIEVEMENT',
  'NOTE',
  'CUSTOM',
]

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [chapterTitle, setChapterTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setBook(await booksApi.get(id))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this book.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function onAddChapter(e: FormEvent) {
    e.preventDefault()
    if (!id || !chapterTitle.trim()) return
    try {
      await chaptersApi.create({ bookId: id, title: chapterTitle.trim() })
      setChapterTitle('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add the chapter.'))
    }
  }

  async function onDeleteChapter(chapter: Chapter) {
    if (!confirm(`Delete chapter "${chapter.title}" and its items?`)) return
    try {
      await chaptersApi.remove(chapter.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the chapter.'))
    }
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>
  if (!book) return <p className="text-red-600">{error ?? 'Book not found.'}</p>

  return (
    <div className="space-y-6">
      <div>
        <Link to="/books" className="text-sm text-neutral-500 hover:underline">
          ← Library
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
          {book.icon ?? '📘'} {book.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Chapters group related entries. Entries live inside chapters — that's as deep as it goes.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={onAddChapter} className="flex gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <input
          value={chapterTitle}
          onChange={(e) => setChapterTitle(e.target.value)}
          placeholder="New chapter (e.g. Jobs, Trips, People)"
          className="flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">
          Add chapter
        </button>
      </form>

      {book.chapters.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
          No chapters yet.
        </p>
      )}

      <div className="space-y-4">
        {book.chapters.map((chapter) => (
          <ChapterCard
            key={chapter.id}
            chapter={chapter}
            onChanged={load}
            onDelete={() => onDeleteChapter(chapter)}
          />
        ))}
      </div>
    </div>
  )
}

function ChapterCard({
  chapter,
  onChanged,
  onDelete,
}: {
  chapter: Chapter
  onChanged: () => Promise<void>
  onDelete: () => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ItemType>('MEMORY')
  const [body, setBody] = useState('')
  const [itemDate, setItemDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onAddItem(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await itemsApi.create({
        chapterId: chapter.id,
        type,
        title: title.trim(),
        body: body.trim() || undefined,
        itemDate: itemDate ? new Date(itemDate).toISOString() : undefined,
      })
      setTitle('')
      setBody('')
      setItemDate('')
      await onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not add the entry.'))
    }
  }

  async function onDeleteItem(item: Item) {
    try {
      await itemsApi.remove(item.id)
      await onChanged()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the entry.'))
    }
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-neutral-900">{chapter.title}</h2>
        <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
          Delete chapter
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-3 space-y-2">
        {chapter.items.map((item) => (
          <li key={item.id} className="rounded border border-neutral-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
                  {item.type}
                </span>
                <p className="mt-1 font-medium text-neutral-900">{item.title}</p>
                {item.itemDate && (
                  <p className="text-xs text-neutral-500">
                    {new Date(item.itemDate).toLocaleDateString()}
                  </p>
                )}
                {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{item.body}</p>}
              </div>
              <button
                onClick={() => onDeleteItem(item)}
                className="shrink-0 text-xs text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {chapter.items.length === 0 && (
          <li className="text-sm text-neutral-400">Nothing in this chapter yet.</li>
        )}
      </ul>

      <form onSubmit={onAddItem} className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className="rounded border border-neutral-300 px-2 py-2 text-sm"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title"
            className="min-w-40 flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={itemDate}
            onChange={(e) => setItemDate(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write freely (optional)"
          rows={2}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100">
          Add entry
        </button>
      </form>
    </section>
  )
}
