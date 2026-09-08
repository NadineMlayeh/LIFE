import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage, getErrorStatus } from '../services/apiError'
import * as authService from '../services/authService'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResendNotice(null)
    setNeedsVerification(false)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setNeedsVerification(getErrorStatus(err) === 403)
      setError(getErrorMessage(err, 'Could not log you in.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function onResend() {
    setResendNotice(null)
    try {
      await authService.resendVerification(email)
      setResendNotice('Verification email sent. Check your inbox.')
    } catch (err) {
      setResendNotice(getErrorMessage(err, 'Could not resend the email.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-semibold text-neutral-900">Log in to LIFE</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {needsVerification && (
          <button
            type="button"
            onClick={onResend}
            className="w-full rounded border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Resend verification email
          </button>
        )}
        {resendNotice && <p className="text-sm text-neutral-700">{resendNotice}</p>}
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-neutral-900 py-2 text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
        <p className="text-center text-sm text-neutral-500">
          No account?{' '}
          <Link to="/signup" className="text-neutral-900 underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}
