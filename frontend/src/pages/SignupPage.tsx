import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../services/apiError'
import * as authService from '../services/authService'

export function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [resendNotice, setResendNotice] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await authService.signup(email, password)
      setSent(true)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    setResendNotice(null)
    try {
      await authService.resendVerification(email)
      setResendNotice('Sent. Check your inbox again.')
    } catch (err) {
      setResendNotice(getErrorMessage(err, 'Could not resend the email.'))
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 text-center shadow">
          <h1 className="text-2xl font-semibold text-neutral-900">Check your email</h1>
          <p className="text-neutral-600">
            We sent a verification link to <span className="font-medium text-neutral-900">{email}</span>.
            Open it to activate your account.
          </p>
          <p className="text-sm text-neutral-500">The link expires in 24 hours.</p>
          {resendNotice && <p className="text-sm text-neutral-700">{resendNotice}</p>}
          <button
            onClick={onResend}
            className="w-full rounded border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Resend email
          </button>
          <p className="text-sm text-neutral-500">
            Already verified?{' '}
            <Link to="/login" className="text-neutral-900 underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-neutral-900">Create your LIFE</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <input
          type="password"
          required
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-neutral-900 py-2 text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Sign up'}
        </button>
        <p className="text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="text-neutral-900 underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
