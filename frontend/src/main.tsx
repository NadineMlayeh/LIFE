import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { prefetchRoom, warmUpApi } from './services/warmUp'
import './index.css'

/*
  Both start before React renders a thing, and neither blocks it.

  The slowest moment in this application is not any of its code — it is the first request after
  the API has been idle, waiting for a serverless function to boot and a sleeping database to
  come back. Starting that clock now means it runs down while the login card is being read
  rather than after a password has been submitted.
*/
warmUpApi()
prefetchRoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
