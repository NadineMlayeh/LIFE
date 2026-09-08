import type {
  Book,
  BookDetail,
  Chapter,
  Item,
  ItemType,
  Note,
  Photo,
  PrivacyEntityType,
  Profile,
  SharedView,
  ShareLink,
  TimelineEvent,
  Visibility,
  VisitedCountry,
} from '../types'
import { api } from './api'

export const profileApi = {
  async get() {
    const { data } = await api.get<Profile | null>('/profile')
    return data
  },
  async save(payload: Partial<Omit<Profile, 'id' | 'userId'>>) {
    const { data } = await api.put<Profile>('/profile', payload)
    return data
  },
}

export const booksApi = {
  async list(includeHidden = false) {
    const { data } = await api.get<Book[]>('/books', { params: { includeHidden } })
    return data
  },
  async get(id: string) {
    const { data } = await api.get<BookDetail>(`/books/${id}`)
    return data
  },
  async create(payload: { title: string; icon?: string }) {
    const { data } = await api.post<Book>('/books', payload)
    return data
  },
  async update(id: string, payload: { title?: string; icon?: string; isHidden?: boolean }) {
    const { data } = await api.patch<Book>(`/books/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await api.delete(`/books/${id}`)
  },
}

export const chaptersApi = {
  async create(payload: { bookId: string; title: string }) {
    const { data } = await api.post<Chapter>('/chapters', payload)
    return data
  },
  async update(id: string, payload: { title?: string; order?: number }) {
    const { data } = await api.patch<Chapter>(`/chapters/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await api.delete(`/chapters/${id}`)
  },
}

export const itemsApi = {
  async create(payload: {
    chapterId: string
    type: ItemType
    title: string
    body?: string
    itemDate?: string
  }) {
    const { data } = await api.post<Item>('/items', payload)
    return data
  },
  async update(
    id: string,
    payload: { type?: ItemType; title?: string; body?: string; itemDate?: string },
  ) {
    const { data } = await api.patch<Item>(`/items/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await api.delete(`/items/${id}`)
  },
}

export const timelineApi = {
  async list(search?: string) {
    const { data } = await api.get<TimelineEvent[]>('/timeline', {
      params: search ? { search } : undefined,
    })
    return data
  },
  async create(payload: {
    title: string
    date: string
    description?: string
    type?: string
    bookId?: string
    isGoal?: boolean
  }) {
    const { data } = await api.post<TimelineEvent>('/timeline', payload)
    return data
  },
  async update(
    id: string,
    payload: {
      title?: string
      date?: string
      description?: string
      bookId?: string
      isGoal?: boolean
      goalStatus?: string
    },
  ) {
    const { data } = await api.patch<TimelineEvent>(`/timeline/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await api.delete(`/timeline/${id}`)
  },
}

export const photosApi = {
  async list() {
    const { data } = await api.get<Photo[]>('/photos')
    return data
  },
  async upload(file: File, caption?: string) {
    const form = new FormData()
    form.append('file', file)
    if (caption) form.append('caption', caption)
    const { data } = await api.post<Photo>('/photos', form)
    return data
  },
  // The room's wall frame. Returns nothing when the gallery is empty, and the backend falls
  // back to the newest photo when none has been explicitly featured.
  async getFeatured() {
    const { data } = await api.get<Photo | ''>('/photos/featured')
    return data || null
  },
  async update(
    id: string,
    payload: { caption?: string; visibility?: Visibility; isFeatured?: boolean },
  ) {
    const { data } = await api.patch<Photo>(`/photos/${id}`, payload)
    return data
  },
  async remove(id: string) {
    await api.delete(`/photos/${id}`)
  },
  // The image route is guarded, so it cannot be used directly as an <img src>. Fetching it
  // with the auth header and wrapping it in an object URL keeps private images private.
  async fetchObjectUrl(id: string) {
    const { data } = await api.get<Blob>(`/photos/${id}/file`, { responseType: 'blob' })
    return URL.createObjectURL(data)
  },
}

export const mapApi = {
  async list() {
    const { data } = await api.get<VisitedCountry[]>('/map/countries')
    return data
  },
  async upsert(payload: {
    countryCode: string
    visitedDate?: string
    notes?: string
    status?: 'visited' | 'future'
  }) {
    const { data } = await api.put<VisitedCountry>('/map/countries', payload)
    return data
  },
  async remove(countryCode: string) {
    await api.delete(`/map/countries/${countryCode}`)
  },
}

export const shareLinksApi = {
  async list() {
    const { data } = await api.get<ShareLink[]>('/share-links')
    return data
  },
  async create() {
    const { data } = await api.post<ShareLink>('/share-links')
    return data
  },
  async revoke(id: string) {
    await api.delete(`/share-links/${id}`)
  },
}

export const sharedApi = {
  async view(token: string) {
    const { data } = await api.get<SharedView>(`/shared/${token}`)
    return data
  },
  async photoUrl(token: string, photoId: string) {
    const { data } = await api.get<Blob>(`/shared/${token}/photos/${photoId}/file`, {
      responseType: 'blob',
    })
    return URL.createObjectURL(data)
  },
}

export const privacyApi = {
  async set(entityType: PrivacyEntityType, entityId: string, visibility: Visibility) {
    await api.put('/privacy', { entityType, entityId, visibility })
  },
}

export const notesApi = {
  async list() {
    const { data } = await api.get<Note[]>('/notes')
    return data
  },
  async create(content: string) {
    const { data } = await api.post<Note>('/notes', { content })
    return data
  },
  async update(id: string, content: string) {
    const { data } = await api.patch<Note>(`/notes/${id}`, { content })
    return data
  },
  async remove(id: string) {
    await api.delete(`/notes/${id}`)
  },
}
