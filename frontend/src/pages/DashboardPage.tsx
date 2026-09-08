import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { booksApi, notesApi, timelineApi } from '../services/lifeApi'

export function DashboardPage() {
  const [counts, setCounts] = useState({ books: 0, events: 0, goals: 0, notes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([booksApi.list(), timelineApi.list(), notesApi.list()])
      .then(([books, events, notes]) => {
        setCounts({
          books: books.length,
          events: events.filter((e) => !e.isGoal).length,
          goals: events.filter((e) => e.isGoal).length,
          notes: notes.length,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Your LIFE</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The plain version. The room comes later — the data underneath is the real thing.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card to="/profile" title="Identity" body="Who you are, on the record." />
        <Card
          to="/books"
          title="Library"
          body={loading ? 'Loading...' : `${counts.books} book${counts.books === 1 ? '' : 's'}`}
        />
        <Card
          to="/timeline"
          title="Timeline"
          body={
            loading
              ? 'Loading...'
              : `${counts.events} event${counts.events === 1 ? '' : 's'} · ${counts.goals} goal${counts.goals === 1 ? '' : 's'}`
          }
        />
        <Card
          to="/notes"
          title="Notebook"
          body={loading ? 'Loading...' : `${counts.notes} note${counts.notes === 1 ? '' : 's'}`}
        />
      </div>
    </div>
  )
}

function Card({ to, title, body }: { to: string; title: string; body: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-400"
    >
      <h2 className="font-medium text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
    </Link>
  )
}
