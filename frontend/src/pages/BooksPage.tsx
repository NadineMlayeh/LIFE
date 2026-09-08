import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PrivacySeal } from '../components/paper/fields'
import { getErrorMessage } from '../services/apiError'
import { booksApi } from '../services/lifeApi'
import type { Book } from '../types'

export function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [showHidden, setShowHidden] = useState(false)
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(includeHidden: boolean) {
    try {
      setBooks(await booksApi.list(includeHidden))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your library.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(showHidden)
  }, [showHidden])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await booksApi.create({ title: title.trim(), icon: icon.trim() || undefined })
      setTitle('')
      setIcon('')
      await load(showHidden)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the book.'))
    }
  }

  async function toggleHidden(book: Book) {
    try {
      await booksApi.update(book.id, { isHidden: !book.isHidden })
      await load(showHidden)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the book.'))
    }
  }

  async function onDelete(book: Book) {
    if (!confirm(`Delete "${book.title}" and everything inside it?`)) return
    try {
      await booksApi.remove(book.id)
      await load(showHidden)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the book.'))
    }
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Library</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The categories your life is made of. Add your own, hide the ones you don't need.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
          />
          Show hidden
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={onCreate} className="flex flex-wrap gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="📔"
          className="w-16 rounded border border-neutral-300 px-3 py-2 text-center"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New book (e.g. My Pets, Photography)"
          className="min-w-48 flex-1 rounded border border-neutral-300 px-3 py-2"
        />
        <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">
          Add book
        </button>
      </form>

      <ul className="grid gap-3 sm:grid-cols-2">
        {books.map((book) => (
          <li
            key={book.id}
            className={`rounded-lg border border-neutral-200 bg-white p-4 ${book.isHidden ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <Link to={`/books/${book.id}`} className="group">
                <span className="text-lg">{book.icon ?? '📘'}</span>{' '}
                <span className="font-medium text-neutral-900 group-hover:underline">
                  {book.title}
                </span>
                <p className="mt-1 text-xs text-neutral-500">
                  {book._count?.chapters ?? 0} chapter{book._count?.chapters === 1 ? '' : 's'}
                  {book.isCustom ? ' · custom' : ''}
                </p>
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-2 text-xs">
                <PrivacySeal
                  entityType="BOOK"
                  entityId={book.id}
                  value={book.visibility ?? 'PRIVATE'}
                />
                <div className="flex gap-2">
                  <button onClick={() => toggleHidden(book)} className="text-neutral-500 hover:underline">
                    {book.isHidden ? 'Unhide' : 'Hide'}
                  </button>
                  <button onClick={() => onDelete(book)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {books.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
          No books yet. Create your first one above.
        </p>
      )}
    </div>
  )
}
