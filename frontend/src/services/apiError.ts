import axios from 'axios'

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Cannot reach the server. Make sure the backend is running.'
    }
    const message = (error.response.data as { message?: string | string[] } | undefined)?.message
    if (Array.isArray(message)) return message[0]
    if (message) return message
  }
  return fallback
}

export function getErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
