import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../services/apiError'
import * as authService from '../services/authService'

type Status = 'verifying' | 'success' | 'error'

export function VerifyPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true

    if (!token) {
      setStatus('error')
      setMessage('This link is missing its verification token.')
      return
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setStatus('success')
        setMessage(res.message)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(getErrorMessage(err, 'This verification link is invalid or has expired.'))
      })
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 text-center shadow">
        {status === 'verifying' && <p className="text-neutral-500">Verifying your email...</p>}

        {status === 'success' && (
          <>
            <h1 className="text-2xl font-semibold text-neutral-900">Email verified</h1>
            <p className="text-neutral-600">{message}</p>
            <Link
              to="/login"
              className="block w-full rounded bg-neutral-900 py-2 text-white transition hover:bg-neutral-700"
            >
              Go to login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-neutral-900">Verification failed</h1>
            <p className="text-neutral-600">{message}</p>
            <Link
              to="/signup"
              className="block w-full rounded border border-neutral-300 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Back to sign up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
