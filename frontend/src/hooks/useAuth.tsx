import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as authService from '../services/authService'

interface AuthContextValue {
  user: authService.AuthUser | null
  loading: boolean
  /** Accepts an email address or a username. */
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  /** Keeps the header in step when the handle is changed from the identity panel. */
  setUser: (user: authService.AuthUser) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<authService.AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('life_token')
    if (!token) {
      setLoading(false)
      return
    }
    authService
      .fetchMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('life_token'))
      .finally(() => setLoading(false))
  }, [])

  async function login(identifier: string, password: string) {
    const res = await authService.login(identifier, password)
    localStorage.setItem('life_token', res.accessToken)
    setUser(res.user)
  }

  function logout() {
    localStorage.removeItem('life_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
