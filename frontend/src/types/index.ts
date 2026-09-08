export type GoalStatus = 'PENDING' | 'ACHIEVED' | 'NOT_ACHIEVED' | 'RESCHEDULED'

export type Visibility = 'PRIVATE' | 'SHARE_ONLY'

export type PrivacyEntityType =
  | 'BOOK'
  | 'PHOTO'
  /** Whole-object switches; their entityId is the user's own id. */
  | 'PROFILE'
  | 'MAP'
  | 'TIMELINE'

export interface Photo {
  id: string
  storagePath: string
  originalName: string
  mimeType: string
  size: number
  caption: string | null
  visibility: Visibility
  /** The one photograph that hangs in the room's wall frame. At most one is true. */
  isFeatured: boolean
  timelineEventId: string | null
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
  onShelf: boolean
  visibility?: Visibility
  _count?: { chapters: number }
}

export interface Chapter {
  id: string
  bookId: string
  title: string
  order: number
  /** The chapter's page, written freely. There is no level below this. */
  content: string | null
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
  /** When the key stops working. `null` means never. */
  expiresAt: string | null
  revoked: boolean
}

export interface Letter {
  id: string
  subject: string
  body: string
  /** A letter may enclose an invitation to the writer's room. Usually null. */
  shareToken: string | null
  readAt: string | null
  createdAt: string
  /** Correspondents are known by their public handle only — never an email address. */
  sender: { username: string }
  recipient: { username: string }
}

export interface SharedView {
  /** Whose room this is. The public handle, never the email. */
  owner: { username: string }
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
      content: string | null
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
  visitedCountries: VisitedCountry[]
  /** Whether the map is shared at all — an empty list could also mean "shared but nowhere". */
  mapShared: boolean
  featuredPhoto: { id: string; caption: string | null; mimeType: string } | null
}
