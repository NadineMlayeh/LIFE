import { useEffect, useState, type ChangeEvent } from 'react'
import { PrivacySeal } from '../components/paper/fields'
import { getErrorMessage } from '../services/apiError'
import { photosApi } from '../services/lifeApi'
import type { Photo } from '../types'
import { compressImage } from '../utils/compressImage'

export function GalleryPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  async function load() {
    try {
      const list = await photosApi.list()
      setPhotos(list)

      const entries = await Promise.all(
        list.map(async (photo) => {
          try {
            return [photo.id, await photosApi.fetchObjectUrl(photo.id)] as const
          } catch {
            return [photo.id, ''] as const
          }
        }),
      )
      setUrls(Object.fromEntries(entries))
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your gallery.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    return () => {
      Object.values(urls).forEach((url) => url && URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSavedNote(null)
    try {
      const compressed = await compressImage(file)
      const savedKb = Math.round((file.size - compressed.size) / 1024)
      await photosApi.upload(compressed)
      if (savedKb > 0) {
        setSavedNote(
          `Compressed before upload: ${Math.round(file.size / 1024)} KB → ${Math.round(compressed.size / 1024)} KB`,
        )
      }
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not upload that image.'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function onDelete(photo: Photo) {
    if (!confirm('Delete this photo?')) return
    try {
      await photosApi.remove(photo.id)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete the photo.'))
    }
  }

  async function onCaptionBlur(photo: Photo, caption: string) {
    if (caption === (photo.caption ?? '')) return
    try {
      await photosApi.update(photo.id, { caption })
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the caption.'))
    }
  }

  if (loading) return <p className="text-neutral-500">Loading...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Gallery</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Selected photos, not a camera roll dump. Images are shrunk in your browser before
          they are uploaded.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedNote && <p className="text-sm text-green-700">{savedNote}</p>}

      <label className="inline-block cursor-pointer rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700">
        {uploading ? 'Uploading...' : 'Add photo'}
        <input
          type="file"
          accept="image/*"
          onChange={onUpload}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-400">
          No photos yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {urls[photo.id] ? (
                <img
                  src={urls[photo.id]}
                  alt={photo.caption ?? photo.originalName}
                  className="h-48 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center bg-neutral-100 text-sm text-neutral-400">
                  Preview unavailable
                </div>
              )}
              <div className="space-y-2 p-3">
                <input
                  defaultValue={photo.caption ?? ''}
                  placeholder="Add a caption"
                  onBlur={(e) => onCaptionBlur(photo, e.target.value)}
                  className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
                />
                <div className="flex items-center justify-between">
                  <PrivacySeal entityType="PHOTO" entityId={photo.id} value={photo.visibility} />
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span>{Math.round(photo.size / 1024)} KB</span>
                    <button onClick={() => onDelete(photo)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
