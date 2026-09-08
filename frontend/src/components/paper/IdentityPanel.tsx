import { useEffect, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../services/apiError'
import { profileApi } from '../../services/lifeApi'
import type { Visibility } from '../../types'
import { Field, PrivacySeal } from './fields'
import { NotebookSection } from './NotebookSection'
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
type Section = 'identity' | 'notebook'

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
      title={section === 'identity' ? 'Who I am' : 'My notebook'}
      variant="sheet"
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
      {/* The mirror holds three things (spec C.1): identity, the notebook and the gallery.
          The gallery has its own frame in the room, so it is a cross-reference here. */}
      <nav className="mb-6 flex items-center gap-1 border-b border-[var(--rule)] pb-2">
        {(
          [
            ['identity', 'Identity'],
            ['notebook', 'Notebook'],
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

      <div style={{ display: section === 'identity' ? 'block' : 'none' }}>
        {loading ? (
        <p className="py-10 text-center text-[var(--ink-faint)]">Opening…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-7">
          {error && <p className="text-sm text-[var(--oxblood)]">{error}</p>}

          <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The plain facts of a life, kept in one place. Every field is optional — this record
            is yours to leave as blank or as full as you like.
          </p>

          <Field
            label="Full name"
            value={form.fullName}
            onChange={(v) => setForm({ ...form, fullName: v })}
          />

          <div className="grid gap-7 sm:grid-cols-2">
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

          <div className="hairline" />

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
