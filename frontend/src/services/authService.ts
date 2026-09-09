import { api } from './api'

export interface AuthUser {
  id: string
  email: string
  /** The public handle. Unique, and changeable. */
  username: string
}

export interface AuthResponse {
  accessToken: string
  user: AuthUser
}

export interface SignupResult {
  message: string
  /**
   * Whether the verification letter actually left the server. An account is created either
   * way — a mail provider being unreachable or refusing the recipient does not undo the
   * registration — so this is what decides whether the next screen promises a letter or
   * admits none was sent.
   */
  delivered: boolean
}

export async function signup(
  email: string,
  username: string,
  password: string,
): Promise<SignupResult> {
  const { data } = await api.post<SignupResult>('/auth/signup', {
    email,
    username,
    password,
  })
  return data
}

/** `identifier` is an email address or a username — whichever the person remembers. */
export async function login(identifier: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { identifier, password })
  return data
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data } = await api.get<{ available: boolean }>('/auth/username-available', {
    params: { username },
  })
  return data.available
}

export async function changeUsername(username: string): Promise<AuthUser> {
  const { data } = await api.patch<AuthUser>('/auth/username', { username })
  return data
}

/**
 * Asks for a reset link. Always resolves, even for an address with no account — the server
 * deliberately gives the same answer either way so the form cannot be used to test whether
 * someone is registered.
 */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/reset-password', {
    token,
    password,
  })
  return data
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const { data } = await api.get<{ message: string }>('/auth/verify', { params: { token } })
  return data
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/resend-verification', { email })
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me')
  return data
}
