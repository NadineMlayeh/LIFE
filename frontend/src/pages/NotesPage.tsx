import { useEffect, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../services/apiError'
import { notesApi } from '../services/lifeApi'
import type { Note } from '../types'

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setNotes(await notesApi.list())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your notebook.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    try {
      await notesApi.create(draft)
      setDraft('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the note.'))
    }
  }

  async function onSaveEdit(id: string) {
    try {
      await notesApi.update(id, editingContent)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the note.'))
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this note?')) return
    try {
      await notesApi.remove(id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the note.'))
    }
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Notebook</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Anything at all. Nothing here needs a category.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={onCreate} className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write something..."
          rows={4}
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
        <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">
          Add note
        </button>
      </form>

      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            {editingId === note.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-neutral-300 px-3 py-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onSaveEdit(note.id)}
                    className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-neutral-800">{note.content}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
                  <span>{new Date(note.updatedAt).toLocaleString()}</span>
                  <button
                    onClick={() => {
                      setEditingId(note.id)
                      setEditingContent(note.content)
                    }}
                    className="hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => onDelete(note.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {notes.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
          Nothing written yet.
        </p>
      )}
    </div>
  )
}
