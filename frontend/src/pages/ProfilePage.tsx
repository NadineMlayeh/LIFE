import { useEffect, useState, type FormEvent } from 'react'
import { PrivacySeal } from '../components/paper/fields'
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage } from '../services/apiError'
import { profileApi } from '../services/lifeApi'
import type { Visibility } from '../types'

const emptyForm = {
  fullName: '',
  dob: '',
  birthplace: '',
  nationality: '',
  languages: '',
}

export function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    profileApi
      .get()
      .then((profile) => {
        if (profile) {
          setVisibility(profile.visibility ?? 'PRIVATE')
          setForm({
            fullName: profile.fullName ?? '',
            dob: profile.dob ? profile.dob.slice(0, 10) : '',
            birthplace: profile.birthplace ?? '',
            nationality: profile.nationality ?? '',
            languages: profile.languages ?? '',
          })
        }
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load your identity record.')))
      .finally(() => setLoading(false))
  }, [])

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
      setNotice('Saved.')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your identity record.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Civil Identity</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The core facts about who you are. Every field is optional.
          </p>
        </div>
        {/* Identity is a whole-object switch, so it is keyed by the user's own id — and it
            now reflects the stored state instead of always claiming to be private. */}
        {user && (
          <PrivacySeal entityType="PROFILE" entityId={user.id} value={visibility} />
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
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
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
      />
    </label>
  )
}
