import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AuthStage,
  BrassButton,
  EngravedField,
  GildedCard,
  Notice,
  Plaque,
  UnderCard,
} from '../components/auth/AuthChrome'
import { getErrorMessage } from '../services/apiError'
import * as authService from '../services/authService'

/**
 * Forgotten passwords, both halves of it.
 *
 * Asking for a link and setting a new one are the same screen with two states, decided by
 * whether the URL carries a token — that is what the emailed link adds. Keeping them together
 * means one card, one visual language, and no page that exists only to say "check your email".
 */
export function PasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')

  return (
    <AuthStage>
      <GildedCard>
        <Plaque title="Life" subtitle={token ? 'Set a new password' : 'A forgotten password'} />
        {token ? <SetNew token={token} /> : <AskForLink />}
      </GildedCard>

      <UnderCard>
        Remembered it?{' '}
        <Link to="/login" className="underline decoration-[#A8863C] underline-offset-4">
          Let yourself in
        </Link>
      </UnderCard>
    </AuthStage>
  )
}

function AskForLink() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await authService.requestPasswordReset(email.trim())
      setSent(res.message)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send a reset link.'))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <Notice tone="ok">{sent}</Notice>
        <p className="mt-4 text-[13px] leading-relaxed" style={{ color: '#A8916B' }}>
          The link works once and lapses after an hour. If it is not in your inbox, look in
          spam.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice>{error}</Notice>}

      <p className="text-[13px] leading-relaxed" style={{ color: '#D6C29C' }}>
        Give the address you signed up with and a link to set a new password will follow.
      </p>

      <EngravedField
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="The address you signed up with"
      />

      <BrassButton busy={sending} disabled={email.trim().length < 4}>
        Send the link
      </BrassButton>
    </form>
  )
}

function SetNew({ token }: { token: string }) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const tooShort = password.length > 0 && password.length < 8
  const matches = password.length > 0 && password === confirm

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await authService.resetPassword(token, password)
      setDone(res.message)
      // Straight to the door, with a moment to read what happened.
      setTimeout(() => navigate('/login'), 2200)
    } catch (err) {
      setError(getErrorMessage(err, 'That reset link is no longer valid.'))
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <Notice tone="ok">{done}</Notice>
        <p className="mt-4 text-[13px]" style={{ color: '#A8916B' }}>
          Taking you to the door…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice>{error}</Notice>}

      <EngravedField
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        note={tooShort ? 'Eight characters or more.' : undefined}
        tone={tooShort ? 'bad' : undefined}
      />

      <EngravedField
        label="Again"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        note={confirm.length > 0 && !matches ? 'These differ.' : undefined}
        tone={confirm.length > 0 && !matches ? 'bad' : undefined}
      />

      <BrassButton busy={saving} disabled={!matches || password.length < 8}>
        Set it
      </BrassButton>
    </form>
  )
}
