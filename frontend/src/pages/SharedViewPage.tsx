import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getErrorMessage } from '../services/apiError'
import { sharedApi } from '../services/lifeApi'
import type { SharedView } from '../types'
import { formatEventDate } from '../utils/dates'

export function SharedViewPage() {
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<SharedView | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    sharedApi
      .view(token)
      .then(async (data) => {
        setView(data)
        const entries = await Promise.all(
          data.photos.map(async (photo) => {
            try {
              return [photo.id, await sharedApi.photoUrl(token, photo.id)] as const
            } catch {
              return [photo.id, ''] as const
            }
          }),
        )
        setPhotoUrls(Object.fromEntries(entries))
      })
      .catch((err) => setError(getErrorMessage(err, 'This share link is not valid.')))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <p className="p-8 text-center text-neutral-500">Loading...</p>

  if (error || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Link not available</h1>
          <p className="mt-2 text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    )
  }

  const isEmpty =
    !view.profile &&
    view.books.length === 0 &&
    view.events.length === 0 &&
    view.photos.length === 0

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">A shared LIFE</p>
          <h1 className="text-xl font-semibold text-neutral-900">
            {view.profile?.fullName ?? 'Someone'} shared part of their life with you
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {isEmpty && (
          <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
            Nothing has been shared on this link yet.
          </p>
        )}

        {view.profile && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Identity
            </h2>
            <dl className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2">
              <Fact label="Name" value={view.profile.fullName} />
              <Fact label="Birthplace" value={view.profile.birthplace} />
              <Fact label="Nationality" value={view.profile.nationality} />
              <Fact label="Languages" value={view.profile.languages} />
            </dl>
          </section>
        )}

        {view.events.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Timeline
            </h2>
            <ol className="space-y-3">
              {view.events.map((event) => (
                <li key={event.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <p className="text-xs text-neutral-500">{formatEventDate(event.date)}</p>
                  <h3 className="font-medium text-neutral-900">
                    {event.goalStatus === 'ACHIEVED' ? '✅ ' : event.isGoal ? '🎯 ' : ''}
                    {event.title}
                  </h3>
                  {event.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">
                      {event.description}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {view.books.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Library
            </h2>
            <div className="space-y-4">
              {view.books.map((book) => (
                <article key={book.id} className="rounded-lg border border-neutral-200 bg-white p-5">
                  <h3 className="font-medium text-neutral-900">
                    {book.icon ?? '📘'} {book.title}
                  </h3>
                  {book.chapters.map((chapter) => (
                    <div key={chapter.id} className="mt-3">
                      <p className="text-sm font-medium text-neutral-700">{chapter.title}</p>
                      <ul className="mt-1 space-y-1">
                        {chapter.items.map((item) => (
                          <li key={item.id} className="text-sm text-neutral-600">
                            • {item.title}
                            {item.body && (
                              <span className="block whitespace-pre-wrap pl-3 text-neutral-500">
                                {item.body}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        )}

        {view.photos.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Gallery
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {view.photos.map((photo) => (
                <li key={photo.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  {photoUrls[photo.id] ? (
                    <img
                      src={photoUrls[photo.id]}
                      alt={photo.caption ?? ''}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="h-48 bg-neutral-100" />
                  )}
                  {photo.caption && (
                    <p className="p-3 text-sm text-neutral-600">{photo.caption}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  )
}
