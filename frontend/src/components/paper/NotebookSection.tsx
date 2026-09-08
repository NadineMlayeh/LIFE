import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { notesApi } from '../../services/lifeApi'
import type { Note } from '../../types'
import { TextArea } from './fields'

/**
 * The personal notebook, which lives behind the mirror beside the identity record (spec
 * C.1.2). Deliberately the least structured surface in LIFE — no title, no category, no type.
 * You write, and it keeps what you wrote.
 */
export function NotebookSection({ active }: { active: boolean }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setNotes(await notesApi.list())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open your notebook.'))
    } finally {
      setLoading(false)
    }
  }

  // Loads once, the first time the notebook is opened. Re-fetching on every tab switch made
  // the panel drop back to "Opening…" and resize, which read as a full page reload.
  const loaded = useRef(false)
  useEffect(() => {
    if (!active || loaded.current) return
    loaded.current = true
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  async function onWrite() {
    if (!draft.trim()) return
    setBusy(true)
    try {
      await notesApi.create(draft)
      setDraft('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save that.'))
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(id: string) {
    setBusy(true)
    try {
      await notesApi.update(id, editingText)
      setEditingId(null)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update that note.'))
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    setBusy(true)
    try {
      await notesApi.remove(id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove that note.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>

  return (
    <div className="space-y-7">
      {error && <p className="text-sm text-[var(--oxblood)]">{error}</p>}

      <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
        Anything at all — thoughts, drafts, reminders. Nothing here needs a title or a place to
        belong.
      </p>

      <div className="space-y-3">
        <TextArea
          value={draft}
          onChange={setDraft}
          placeholder="Write something…"
          rows={4}
        />
        <button onClick={onWrite} disabled={busy || !draft.trim()} className="brass-button">
          Write it down
        </button>
      </div>

      <div className="hairline" />

      {notes.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-[var(--ink-faint)]">
          The notebook is empty.
        </p>
      ) : (
        <ul className="space-y-5">
          <AnimatePresence initial={false}>
            {notes.map((note) => (
              <motion.li
                key={note.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <TextArea value={editingText} onChange={setEditingText} rows={4} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => onSaveEdit(note.id)}
                        disabled={busy}
                        className="brass-button"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="quiet-button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p
                      className="whitespace-pre-wrap text-[15px] leading-[28px] text-[var(--ink)]"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(to bottom, transparent 0 27px, rgba(58,44,29,0.1) 27px 28px)',
                      }}
                    >
                      {note.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--ink-faint)]">
                      <span>
                        {new Date(note.updatedAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(note.id)
                          setEditingText(note.content)
                        }}
                        className="quiet-button !p-0 !text-[12px]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(note.id)}
                        className="quiet-button !p-0 !text-[12px]"
                        style={{ color: 'var(--oxblood)' }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
