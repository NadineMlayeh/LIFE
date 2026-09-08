import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const links = [
  { to: '/room', label: 'Room' },
  { to: '/dashboard', label: 'Home' },
  { to: '/profile', label: 'Identity' },
  { to: '/books', label: 'Library' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/notes', label: 'Notebook' },
  { to: '/sharing', label: 'Sharing' },
]

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold tracking-tight text-neutral-900">LIFE</span>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">{user?.email}</span>
            <button
              onClick={logout}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
