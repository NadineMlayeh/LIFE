import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthDoors } from './pages/LoginPage'
import { VisitPage } from './pages/VisitPage'
import { PasswordPage } from './pages/PasswordPage'
import { VerifyPage } from './pages/VerifyPage'

// Three.js is ~360 KB gzipped, so it is kept out of the first load: the auth doors and a
// share link's error page should not have to wait for it.
const RoomPage = lazy(() => import('./pages/RoomPage').then((m) => ({ default: m.RoomPage })))

function App() {
  return (
    <Routes>
      {/* Both doors are the SAME element type on purpose. Rendering <LoginPage/> and
          <SignupPage/> made React unmount the whole tree and build a new one on every switch,
          which is what made the card flash and reset. One element type means it reconciles
          instead, and the card simply slides. */}
      <Route path="/login" element={<AuthDoors />} />
      <Route path="/signup" element={<AuthDoors />} />
      <Route path="/verify" element={<VerifyPage />} />
      {/* Both halves of a forgotten password. `/reset` is what the emailed link points at; the
          page tells them apart by whether a token is present. */}
      <Route path="/forgot" element={<PasswordPage />} />
      <Route path="/reset" element={<PasswordPage />} />
      {/* A share link opens the room itself, not a summary of it. */}
      <Route path="/share/:token" element={<VisitPage />} />
      {/* The room is the whole application. Sharing lives in the mirror and letters in the
          letter box, so there is no settings page and no plain interface — the only thing in
          the room's corner is the way out. */}
      <Route
        path="/room"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#EFE2CE]">
                  <p className="text-sm tracking-wide text-[#7A5233]">Opening your room...</p>
                </div>
              }
            >
              <RoomPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      {/* Everything lives in the room. There is no plain interface to fall back to. */}
      <Route path="*" element={<Navigate to="/room" replace />} />
    </Routes>
  )
}

export default App
