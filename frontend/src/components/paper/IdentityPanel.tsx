import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage, getErrorStatus } from '../../services/apiError'
import * as authService from '../../services/authService'
import { profileApi } from '../../services/lifeApi'
import type { Visibility } from '../../types'
import { Field, PrivacySeal } from './fields'
import { NotebookSection } from './NotebookSection'
import { SharingSection } from './SharingSection'
import { Panel } from './Panel'

const EMPTY = {
  fullName: '',
  dob: '',
  birthplace: '',
  nationality: '',
  languages: '',
}

/**
 * The identity record, set as a printed certificate rather than a settings form. Identity is
 * shared as a whole — one seal at the head of the document, not a switch per line.
 */
type Section = 'identity' | 'notebook' | 'sharing'

export function IdentityPanel({
  open,
  onClose,
  userId,
  onOpenGallery,
}: {
  open: boolean
  onClose: () => void
  userId: string
  onOpenGallery: () => void
}) {
  const [section, setSection] = useState<Section>('identity')
  const [form, setForm] = useState(EMPTY)
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    profileApi
      .get()
      .then((profile) => {
        if (profile) {
          setForm({
            fullName: profile.fullName ?? '',
            dob: profile.dob ? profile.dob.slice(0, 10) : '',
            birthplace: profile.birthplace ?? '',
            nationality: profile.nationality ?? '',
            languages: profile.languages ?? '',
          })
          setVisibility(profile.visibility ?? 'PRIVATE')
        }
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not open your identity record.')))
      .finally(() => setLoading(false))
  }, [open])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      await profileApi.save({
        fullName: form.fullName || undefined,
        dob: form.dob ? new Date(form.dob).toISOString() : undefined,
        birthplace: form.birthplace || undefined,
        nationality: form.nationality || undefined,
        languages: form.languages || undefined,
      })
      setNotice('Recorded.')
      setTimeout(() => setNotice(null), 2400)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your identity record.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      open={open}
      onClose={onClose}
      subtitle="The mirror"
      title={
        section === 'identity'
          ? 'Who I am'
          : section === 'notebook'
            ? 'My notebook'
            : 'Sharing link'
      }
      variant="sheet"
      steady
      actions={
        section === 'identity' ? (
          <PrivacySeal
            entityType="PROFILE"
            entityId={userId}
            value={visibility}
            onChanged={setVisibility}
          />
        ) : null
      }
    >
      {/* The mirror holds what you decide about yourself: the record, the notebook, and who
          may come in. The gallery has its own frame in the room, so it is only a
          cross-reference here. */}
      <nav className="mb-5 flex items-center gap-1 border-b border-[var(--rule)] pb-2">
        {(
          [
            ['identity', 'Identity'],
            ['notebook', 'Notebook'],
            ['sharing', 'Sharing link'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className="relative px-3 py-1.5 text-[13px] transition"
            style={{
              color: section === key ? 'var(--ink)' : 'var(--ink-faint)',
              fontFamily: 'var(--serif)',
            }}
          >
            {label}
            {section === key && (
              <span
                className="absolute inset-x-2 -bottom-[9px] block h-[2px]"
                style={{ backgroundColor: 'var(--brass)' }}
              />
            )}
          </button>
        ))}
        <button
          onClick={onOpenGallery}
          className="ml-auto px-3 py-1.5 text-[13px] text-[var(--ink-faint)] transition hover:text-[var(--ink)]"
          style={{ fontFamily: 'var(--serif)' }}
        >
          Gallery →
        </button>
      </nav>

      {/*
        Both sections stay mounted and are shown or hidden, rather than swapped. Unmounting
        the notebook threw away everything it had loaded, so returning to it started from
        "Opening…" again — that reload was the flash. It also loads as soon as the panel opens,
        so the first switch is instant too.
      */}
      <div style={{ display: section === 'notebook' ? 'block' : 'none' }}>
        <NotebookSection active={open} />
      </div>

      <div style={{ display: section === 'sharing' ? 'block' : 'none' }}>
        <SharingSection active={open} />
      </div>

      {/* Six fields in three rows, so the whole record — and the button that saves it — sits
          on one page. Stacked, it ran past the bottom of the sheet and Record had to be
          scrolled to, which is the one control that must never be hidden. */}
      <div style={{ display: section === 'identity' ? 'block' : 'none' }}>
        {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="text-sm text-[var(--oxblood)]">{error}</p>}

          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <HandleField />
            <Field
              label="Full name"
              value={form.fullName}
              onChange={(v) => setForm({ ...form, fullName: v })}
            />
            <Field
              label="Date of birth"
              type="date"
              value={form.dob}
              onChange={(v) => setForm({ ...form, dob: v })}
            />
            <Field
              label="Birthplace"
              value={form.birthplace}
              onChange={(v) => setForm({ ...form, birthplace: v })}
            />
            <Field
              label="Nationality"
              value={form.nationality}
              onChange={(v) => setForm({ ...form, nationality: v })}
            />
            <Field
              label="Languages"
              value={form.languages}
              onChange={(v) => setForm({ ...form, languages: v })}
              placeholder="Arabic, French, English"
            />
          </div>

          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving} className="brass-button">
              {saving ? 'Recording…' : 'Record'}
            </button>
            {notice && <span className="text-[13px] text-[var(--forest)]">{notice}</span>}
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">
              {visibility === 'SHARE_ONLY'
                ? 'Visible to anyone holding your share link'
                : 'Visible only to you'}
            </span>
          </div>
          </form>
        )}
      </div>
    </Panel>
  )
}


/**
 * The public handle, changed in place.
 *
 * It is not permanent — a name chosen years ago should not be a life sentence — but it is
 * unique, so this checks before it saves and says plainly when the name has gone. The old
 * handle is released the moment the new one is taken, which is the accepted cost of allowing
 * renames at all.
 */
function HandleField() {
  const { user, setUser } = useAuth()
  const [value, setValue] = useState(user?.username ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'taken' | 'bad' | 'failed'>(
    'idle',
  )

  useEffect(() => {
    if (user?.username) setValue(user.username)
  }, [user?.username])

  const changed = value.trim() !== (user?.username ?? '')
  const shaped = /^[a-zA-Z][a-zA-Z0-9_]{2,23}$/.test(value.trim())

  async function save() {
    const next = value.trim()
    if (!changed) return
    if (!shaped) {
      setState('bad')
      return
    }
    setState('saving')
    try {
      const updated = await authService.changeUsername(next)
      setUser(updated)
      setState('saved')
    } catch (err) {
      setState(getErrorStatus(err) === 409 ? 'taken' : 'failed')
    }
  }

  const note =
    state === 'saving'
      ? 'Saving…'
      : state === 'saved'
        ? 'Saved.'
        : state === 'taken'
          ? 'Someone already has that one.'
          : state === 'bad'
            ? 'Letters, numbers and underscores. Start with a letter, 3–24 long.'
            : state === 'failed'
              ? 'That did not save.'
              : 'How others find you. Never your email.'

  return (
    <div>
      <Field
        label="Username"
        value={value}
        onChange={(v) => {
          setValue(v)
          setState('idle')
        }}
      />
      <div className="mt-1 flex items-center gap-3">
        <p
          className="min-w-0 flex-1 text-[12px]"
          style={{
            color:
              state === 'taken' || state === 'bad' || state === 'failed'
                ? 'var(--oxblood)'
                : 'var(--ink-faint)',
          }}
        >
          {note}
        </p>
        {changed && (
          <button type="button" onClick={save} className="quiet-button shrink-0 !p-0">
            Change it
          </button>
        )}
      </div>
    </div>
  )
}
