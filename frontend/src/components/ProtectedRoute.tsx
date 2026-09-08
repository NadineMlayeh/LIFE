import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="p-8 text-center text-neutral-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
