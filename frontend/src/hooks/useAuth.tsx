import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import * as authService from '../services/authService'

interface User {
  id: string
  email: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
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

  async function login(email: string, password: string) {
    const res = await authService.login(email, password)
    localStorage.setItem('life_token', res.accessToken)
    setUser(res.user)
  }

  function logout() {
    localStorage.removeItem('life_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
