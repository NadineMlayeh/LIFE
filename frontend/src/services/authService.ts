import { api } from './api'

export interface AuthResponse {
  accessToken: string
  user: { id: string; email: string }
}

export async function signup(email: string, password: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/auth/signup', { email, password })
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
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

export async function fetchMe(): Promise<AuthResponse['user']> {
  const { data } = await api.get<AuthResponse['user']>('/auth/me')
  return data
}
