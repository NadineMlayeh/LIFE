export type ItemType =
  | 'PERSON'
  | 'PLACE'
  | 'MEMORY'
  | 'EVENT'
  | 'ACHIEVEMENT'
  | 'NOTE'
  | 'FILE'
  | 'PHOTO'
  | 'CUSTOM'

export type GoalStatus = 'PENDING' | 'ACHIEVED' | 'NOT_ACHIEVED' | 'RESCHEDULED'

export type Visibility = 'PRIVATE' | 'SHARE_ONLY'

export type PrivacyEntityType =
  | 'BOOK'
  | 'TIMELINE_EVENT'
  | 'PHOTO'
  | 'NOTE'
  /** Whole-object switches; their entityId is the user's own id. */
  | 'PROFILE'
  | 'MAP'

export interface Photo {
  id: string
  storagePath: string
  originalName: string
  mimeType: string
  size: number
  caption: string | null
  visibility: Visibility
  createdAt: string
}

export interface Profile {
  id: string
  userId: string
  fullName: string | null
  dob: string | null
  birthplace: string | null
  nationality: string | null
  languages: string | null
  /** Identity is shared as a whole, so the record carries its own switch. */
  visibility: Visibility
}

export interface Book {
  id: string
  title: string
  icon: string | null
  isCustom: boolean
  isHidden: boolean
  visibility?: Visibility
  _count?: { chapters: number }
}

export interface Item {
  id: string
  chapterId: string
  type: ItemType
  title: string
  body: string | null
  itemDate: string | null
}

export interface Chapter {
  id: string
  bookId: string
  title: string
  order: number
  items: Item[]
}

export interface BookDetail extends Book {
  chapters: Chapter[]
}

export interface TimelineEvent {
  id: string
  title: string
  date: string
  description: string | null
  type: string | null
  bookId: string | null
  isGoal: boolean
  goalStatus: GoalStatus | null
  visibility?: Visibility
  book?: { id: string; title: string; icon: string | null } | null
}

export interface Note {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface VisitedCountry {
  id: string
  countryCode: string
  visitedDate: string | null
  notes: string | null
  status: string
}

export interface ShareLink {
  id: string
  token: string
  createdAt: string
  revoked: boolean
}

export interface SharedView {
  profile: {
    fullName: string | null
    birthplace: string | null
    nationality: string | null
    languages: string | null
  } | null
  books: {
    id: string
    title: string
    icon: string | null
    chapters: {
      id: string
      title: string
      items: {
        id: string
        type: ItemType
        title: string
        body: string | null
        itemDate: string | null
      }[]
    }[]
  }[]
  events: {
    id: string
    title: string
    date: string
    description: string | null
    isGoal: boolean
    goalStatus: GoalStatus | null
    book: { id: string; title: string; icon: string | null } | null
  }[]
  photos: { id: string; caption: string | null; mimeType: string }[]
}
