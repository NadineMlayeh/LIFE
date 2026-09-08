# LIFE — Build Spec (v3, agent-ready)

> This document merges two earlier drafts, removes speculative scope, and reorders everything
> into small shippable phases. Follow phases IN ORDER. Do not start Phase 2 UI/room work
> before Phase 1's data layer is fully working and deployed.

## 0. What LIFE is

A private web app where a person records their life in one connected model: identity,
memories, books (life categories), a chronological timeline (past events + future goals),
photos, and simple map/sharing features.

**Two layers, kept strictly separate in the codebase:**
- **Data layer** — a conventional, boring, well-tested CRUD app (auth, books, timeline, privacy).
- **Visual layer** — a "room" skin (SVG/React/Framer Motion) that sits on top and calls the
  same API a normal dashboard would.

The data layer must work perfectly with zero room graphics before any room work starts.
This is the single most important rule in this document.

## 1. Explicitly OUT of scope for v1 (do not build, do not scaffold)

- Mailbox / messaging
- Public discoverable profiles / "LIFE network"
- Weather-based room lighting
- Password-protected or expiring share links
- Any AI features
- Three.js / full 3D
- Multi-user collaboration on one LIFE

These may return later. An agent should not create modules, tables, or routes for them.

## 2. Locked tech stack (no alternatives, no "optionally")

**Frontend:** React + TypeScript + Vite + Framer Motion + SVG + CSS Modules
**Backend:** NestJS + TypeScript + Prisma + PostgreSQL + REST
**Auth:** Supabase Auth (do not hand-roll JWT/auth flows)
**DB + File storage:** Supabase free tier (Postgres + Storage)
**Frontend hosting:** Vercel (Hobby — personal/non-commercial use only; revisit before any commercial launch)
**Backend hosting:** Render free tier (or equivalent; confirm current free-tier availability before Phase 1)

## 3. Data model (final for v1 — do not add Mailbox/PublicProfile tables yet)

```
User            (from Supabase Auth; store profile row keyed by auth user id)
Profile         (identity fields: name, dob, birthplace, nationality?, languages?)
Book            (id, userId, title, icon, isCustom, isHidden)
Chapter         (id, bookId, title)
Item            (id, chapterId, type, title, body, dateOrNull)
TimelineEvent   (id, userId, title, date, description, type, bookId?, isGoal, goalStatus?)
Note            (id, userId, content, createdAt) -- the free-form notebook
Photo           (id, userId, storagePath, originalName, mimeType, size, caption?, visibility)
File            (id, userId, storagePath, originalName, mimeType, size, visibility)
VisitedCountry  (id, userId, countryCode, visitedDate?, notes?)
PrivacySetting  (entityType, entityId, userId, visibility: PRIVATE|SHARE_ONLY|PUBLIC)
ShareLink       (id, userId, token (crypto-random), createdAt, revoked)
```

Rules:
- Every visibility-controlling field defaults to `PRIVATE`.
- `PUBLIC` is stored as a schema option now, but the "discovery" feature that would use it is
  out of scope — public just means "visible via a share link too, no token required" isn't a
  real v1 use case; effectively treat only `PRIVATE` and `SHARE_ONLY` as active in v1 UI.
- Privacy is enforced in NestJS service/guard layer, never only in the frontend. Every read
  endpoint for shareable content must check: owner? → allow. Valid share token for this
  content? → allow. Else → 403/omit from response entirely (never send private data to a
  browser that then hides it with CSS).

## 4. Phase plan

### Phase 0 — Skeleton (no room, no styling polish)
- Vite React app + NestJS app + Prisma schema above + Supabase project wired up
- Supabase Auth login/signup working end to end
- Deploy both (Vercel + Render) — a boring deployed app is the milestone, not a local demo
- **Definition of done:** you can sign up, log in, and see an empty authenticated dashboard in production.

### Phase 1 — Core data, plain UI
- Profile (identity) CRUD
- Books/Chapters/Items CRUD, including custom books
- Timeline: create event, auto-sort by date, event detail view
- Goals: same table as events, `isGoal=true`, manual "did you accomplish this" status update
  (skip automated date-arrival notifications for v1 — check on page load instead of building
  a notification system)
- Notes (free-form notebook)
- Photo upload → Supabase Storage, with client-side compression + max-dimension resize
  **before** upload (do this now, not later — protects your storage cap from day one)
- Privacy toggle (Private/Share-only) on: profile fields, books, timeline events, photos
- **Definition of done:** a fully usable, ugly, plain-HTML version of LIFE, deployed, that you
  personally use for a week to find data-model gaps before touching visual design.

### Phase 2 — Sharing
- Generate/revoke a share link (crypto-random token, no expiry/password for v1)
- Public (token-gated) read-only view showing only content marked Share-only, enforced server-side
- **Definition of done:** you can send yourself the link in an incognito window and see only
  what you marked shared.

### Phase 3 — Visual proof of concept (before full room)
- Pick ONE illustration style/approach (hand-drawn SVG, or a sourced isometric room kit sliced
  into layers — decide this before writing code)
- Build exactly 2 interactive objects fully (recommend: Bookshelf + Clock/Timeline) with
  real hover/click animation, wired to Phase 1 data
- Look at it for a few days. If the style doesn't hold up with 2 objects, change approach now —
  don't build the remaining 6 objects on a style you're not happy with.

### Phase 4 — Full room
- Remaining objects: Mirror (identity/notebook/gallery), Map, Photo frames, Privacy key
- Parallax layers (background/furniture/interactive/foreground movement as originally spec'd)
- Room entrance + transition animations
- Mobile: simplified vertical layout, not a shrunk desktop room

### Phase 5 — Polish
- Room lighting via local browser time (morning/day/sunset/night) — no external API
- Micro-interactions, loading states, empty states
- Write it up (README with screenshots/GIF + a short blog post) — for portfolio purposes,
  a documented, deployed Phase 1–2 app beats an undocumented, unfinished Phase 4 app.

## 5. Backend module list (Phase 0–2 only; add more only when a later phase needs them)

```
auth (thin wrapper around Supabase Auth verification)
profiles
books
chapters
items
timeline
goals
notes
gallery (photo metadata; upload goes to Supabase Storage directly or via signed URL)
files
privacy
sharing
```

## 6. Frontend structure (unchanged from original draft — this part was already good)

```
src/
├── components/
│   ├── room/        (Room, Mirror, Bookshelf, Clock, Window, Map, PrivacyKey, PhotoFrame)
│   ├── mirror/
│   ├── library/
│   ├── timeline/
│   ├── gallery/
│   ├── map/
│   └── sharing/
├── hooks/
├── services/
├── types/
└── pages/            (plain, room-less versions live here through Phase 2)
```

## 7. Non-negotiable engineering rules (repeated because they matter)

1. Room is data-driven — never hardcode a book/event/photo into a component.
2. Privacy enforced server-side only. No exceptions.
3. Compress/resize images client-side before upload.
4. No Mailbox, no public discovery, no weather API, no AI features in v1.
5. Ship Phase 0 and Phase 1 to production before writing a single line of room SVG.
