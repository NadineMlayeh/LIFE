import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BookDetailPage } from './pages/BookDetailPage'
import { BooksPage } from './pages/BooksPage'
import { DashboardPage } from './pages/DashboardPage'
import { GalleryPage } from './pages/GalleryPage'
import { LoginPage } from './pages/LoginPage'
import { NotesPage } from './pages/NotesPage'
import { ProfilePage } from './pages/ProfilePage'
import { SharedViewPage } from './pages/SharedViewPage'
import { SharingPage } from './pages/SharingPage'
import { SignupPage } from './pages/SignupPage'
import { TimelinePage } from './pages/TimelinePage'
import { VerifyPage } from './pages/VerifyPage'

// Three.js is ~360 KB gzipped. Only people who actually open the room should download it —
// the plain UI stays light.
const RoomPage = lazy(() => import('./pages/RoomPage').then((m) => ({ default: m.RoomPage })))

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/share/:token" element={<SharedViewPage />} />
      {/* The room sits outside the plain-UI chrome — it is its own full-screen world. */}
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
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/sharing" element={<SharingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
