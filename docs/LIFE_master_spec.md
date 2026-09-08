# LIFE — Master Build Spec (full detail, phased)

This is the complete specification for LIFE, merged from all prior drafts. It contains
**everything** — full product vision, every feature in detail, the full data model, and the
full technical architecture — organized into ordered phases so a coding agent can see the
whole picture but still work step by step.

**Rule for the agent: read the whole document for context, but only implement the phase
currently requested. Do not build ahead of the current phase.**

---

## PART A — Vision

### A.1 What LIFE is

LIFE is a private, interactive web application representing a person's entire life as one
connected digital world, instead of scattering it across photo apps, notebooks, calendars,
CVs, files, and social profiles. The user enters a small personal room. The room is the
visual shell; the database underneath is the actual LIFE.

### A.2 Three core questions

- 🪞 **Mirror** — Who am I? (identity, personal writing, photos)
- 📚 **Bookshelf** — What makes up my life? (life categories/books)
- 🕰️ **Clock/Timeline** — When did things happen, and what's coming? (past events + future goals)

Everything else (map, privacy, sharing, window) supports these three.

### A.3 Final product definition

LIFE is a private digital world where identity, memories, relationships, achievements,
places, files, goals, and important moments are represented as one connected life. Not
primarily a diary, calendar, gallery, CV, social network, or notes app — it combines elements
of all of them under one visual metaphor with a serious data model underneath.

Guiding principle: **"Beautiful on the surface, conventional underneath."** Clicking an
object opens its content immediately — no forced decorative interactions to reach real
information.

Final principle: **do not build a dashboard disguised as a room; build a room that happens to
contain a powerful application.**

---

## PART B — Visual & UX Design System

### B.1 Style direction
Cozy, elegant, personal, slightly magical, warm, modern, spatial, tactile, calm.
Explicitly NOT: childish, corporate, videogame-like, or full 3D. Target: a **2.5D illustrated
environment**, not a 3D game — depth via layering and animation, not a 3D engine.

### B.2 Rendering strategy (hybrid composition)
- **SVG** — room architecture: walls, floor, bookshelf, mirror, clock, map frame, mailbox,
  key, furniture silhouettes, and any element that needs to be individually interactive/animated.
- **Raster (PNG/WebP)** — photographs, textures, paintings, book cover art, decorative
  illustrations, user-uploaded images.
- **React** — object state, navigation, data, dynamic content, conditional visibility, privacy state.
- **Framer Motion** — hover movement, scale, rotation, page/room transitions, book opening,
  mirror transition, timeline animation, subtle parallax.

### B.3 Depth without Three.js
Layer the scene: background wall → architectural elements → furniture → interactive objects →
decorative objects → foreground elements → UI overlays. Achieve depth with shadows,
gradients, blur, perspective, opacity, scale, and parallax — never a 3D engine.

Suggested parallax movement on cursor move (keep subtle — room should feel alive, not shaky):
- Background: ~2px
- Furniture: ~5px
- Foreground: ~10px

### B.4 Animation strategy (Framer Motion)
- Room entrance: objects gently appear
- Book hover: translate + scale + shadow
- Book opening: scale/rotate into full content view
- Mirror: reflection brightens, room fades, personal space appears
- Timeline: events enter progressively, selected event expands, auto-scroll
- Map: country highlight animation
- Mailbox (future): subtle bounce on arrival
Keep animations short and purposeful — avoid excess.

### B.5 Responsiveness
- **Desktop:** full immersive room.
- **Tablet:** reduced environment, larger touch targets.
- **Mobile:** the room simplifies into a vertical composition — do not try to preserve the
  desktop room pixel-for-pixel. Information architecture must stay fully usable even when
  the visual environment is simplified.

### B.6 The Window (atmosphere only)
A decorative window whose lighting changes with local device time — no external API needed:
`browser local time → hour → morning/afternoon/evening/night → room lighting state`.
Example ranges (refine later): 06:00–11:00 morning, 11:00–17:00 day, 17:00–20:00 sunset,
20:00–06:00 night. This works fully offline once the page has loaded. Weather-based lighting
is explicitly excluded (introduces an external dependency) — future idea only, not v1.

---

## PART C — Features (full detail)

### C.1 Mirror — Identity layer
Clicking the mirror transitions into a dedicated personal space (mirror enlarges → reflection
brightens → room fades → personal space appears → three features become available).

**C.1.1 Civil Identity** — a LIFE-original "identity record" interface, visually inspired by
(not imitating) a birth certificate. Fields: full name, date of birth, birthplace, optional
nationality, optional languages, other basic identity info. Every field individually
privacy-controllable.

**C.1.2 Personal Notebook** — intentionally unstructured free-form space: thoughts, ideas,
reflections, reminders, drafts, misc notes. Feels like a physical notebook, functions like a
modern editor. Supports text, headings, lists, checkboxes, images, attachments, links. The
user is never forced to categorize a note — this is the "dump anything here" space.

**C.1.3 Gallery** — an album, not a plain grid. Upload/delete/view photos, optional captions,
optional association with timeline events or books. Represents *selected* meaningful photos,
not a full camera-roll dump. Photos live in object storage; DB stores only metadata + path.

### C.2 Bookshelf — Life Library
Represents the global structure of the user's life.

**Default books (hideable, not mandatory):** Family, Career, Education, Relationships,
Health, Travel, Hobbies, Achievements, Places, Finance, Personal Development.

**C.2.1 Custom books** — users create unlimited custom books within plan/storage limits
(e.g. My Pets, Gaming, Books I've Read, Photography, Programming, My Cars, Recipes, Personal
Projects). LIFE never dictates what counts as a "category of life" — the user owns the structure.

**C.2.2 Book interaction** — hover: slight lift, scale up, shadow, cover/title become clearer.
Click: book moves forward, scales, opens, transitions into a full content environment. Must
stay fast/responsive.

**C.2.3 Book structure** — fixed hierarchy **Book → Chapter → Item**, no deeper recursive
nesting (avoids turning LIFE into a filesystem). Example: Career → Jobs → Company A, where
Company A holds description, dates, photos, files, notes, related people, related timeline events.

**C.2.4 Item types:** Person, Place, Memory, Event, Achievement, Note, File, Photo, Custom item.

**C.2.5 Structured + free-form** — books support both structured fields (dates, people,
files, photos, events) and free writing. Principle: *structured when useful, free when desired.*

### C.3 Timeline
The chronological backbone: events, memories, achievements, relationships, education/career
milestones, travel, family events, and future goals. Vertical layout.

**C.3.1 Normalized spacing** — visual distance between events is NOT proportional to real
time (a 2002→2026 gap should not create a huge empty space). Every event gets roughly equal
visual spacing; chronological order is preserved; exact dates remain visible via labels.

**C.3.2 Gap tooltip** — hovering the connector between two events shows the real elapsed time,
e.g. "6 years, 2 months apart."

**C.3.3 Auto-ordering** — events are always sorted by date automatically; the user never
manually positions an event on the timeline.

**C.3.4 Add Event** — prominent "+ Add Event" button. Fields: title, date, optional
description, optional type, optional photo, optional book association. On save: validate →
persist → re-sort → insert into timeline → animate into position.

**C.3.5 Event detail view** — title, exact date, description, attachments (photo/document),
and linked book(s) — the event acts as a connection point between Timeline and Library.

**C.3.6 Search** — date-jump (enter a date, scroll to nearest event) and text search
(match title/description). Becomes essential once a timeline has hundreds of events.

**C.3.7 Goals** — no separate goal timeline; a goal is simply a future point on the same
timeline (e.g. "🎯 Learn Spanish — 2027"). Timeline therefore spans Past (completed, solid/
muted) → Present (strongest visual emphasis) → Future (goals, outlined/lighter/subtly glowing).
Use color sparingly, as a semantic accent only.

**C.3.8 Goal resolution** — when a goal's date arrives, prompt: "Did you accomplish this?"
with options Yes / Not yet / Reschedule. If Yes, the goal becomes a completed historical
event — Future → Present → Past inside the same timeline. (v1 note: check this on page load
rather than building a push-notification system — see Phase 2.)

### C.4 World Map
Decorative wall map representing places visited. States: not visited / visited / future
destination (optional). Clicking a visited country can reveal visit date, trip notes, photos,
related timeline events, and related Travel-book content — connecting the map to the rest of
the data model. Keep visually simple.

### C.5 Photo Frames
Decorative frames around the room showing selected Gallery photos. Not a separate photo
system — purely a visual reflection of existing Gallery data. Changing a featured photo in
the Gallery updates the frame automatically.

### C.6 Privacy Key
Represents "what part of my LIFE am I allowing others to see?" Works at the level of:
identity fields, books, chapters, items, timeline events/goals, photos, notes, files, visited
countries.

**Three privacy levels:**
- **PRIVATE** (default) — owner only.
- **SHARE ONLY** — visible only to holders of a specific unguessable share link
  (e.g. `life.app/share/8f72k...`). Recipient needs no LIFE account. Private content stays
  inaccessible regardless of what else is shared.
- **PUBLIC** — discoverable by other LIFE accounts. Explicitly a v3+/future feature, not v1
  (see Part E, Phase 7) — schema may reserve the value, but no discovery UI ships in v1.

### C.7 Sharing
Owner generates a share link → copies it → sends it anywhere (Messenger, WhatsApp, email,
etc.) → recipient opens it and sees the user's **room**, filtered to Share-only content, not
a boring JSON/profile page. The viewer never sees an object just because they can see the
room — every object (Mirror, Bookshelf, Timeline, Map, Gallery) independently filters to only
what's marked shared.

**Share link security:** cryptographically random tokens (never sequential/guessable IDs like
`/share/user/42`). Backend validates token → owner → permitted content → privacy state on
every request. Link expiry, revocation, and password-protected shares are v2+ enhancements,
not required for the first shareable version (basic revoke is included in v1, see Phase 4).

### C.8 Mailbox (future — Phase 6, not v1)
Represents incoming/outgoing LIFE sharing activity: messages, requests to view someone's
LIFE, received shared profiles, invitations. Deliberately minimal even when built — LIFE
should not become a social network. Not part of the initial build; do not scaffold this module early.

### C.9 Future Public LIFE Network (Phase 7, explicitly post-v1)
A later evolution where LIFE profiles can become discoverable between accounts, with only
`PUBLIC`-marked content visible. This is the final stage of:
`PRIVATE (owner only) → SHARE ONLY (link holders) → PUBLIC (discoverable)`.
This must not complicate the first version — no code for this ships until Phases 0–6 are solid.

---

## PART D — Technical Architecture

### D.1 Locked stack decisions

**Frontend:** React + TypeScript + Vite + Framer Motion + SVG + CSS Modules
**Backend:** NestJS + TypeScript + Prisma + PostgreSQL + REST API
**Dev-phase auth:** simple email/password (bcrypt hashing + JWT) — see D.4
**Dev-phase storage:** local filesystem — see D.4
**Deployment-phase infra (Phase 5+):** Supabase (Postgres + Storage + optionally swap auth to
Supabase Auth), frontend on Vercel (Hobby — personal/non-commercial only), backend on
Render free tier (confirm current availability before that phase)

No paid APIs, no paid AI services, no paid cloud dependency anywhere in v1–v2.

### D.2 Data model (full — all entities, all phases; agent should only migrate the ones needed by the current phase)

```
User              (id, email, passwordHash*, createdAt)   *swapped for Supabase Auth at deploy
Profile           (userId, fullName, dob, birthplace, nationality?, languages?)

Book              (id, userId, title, icon, isCustom, isHidden)
Chapter           (id, bookId, title, order)
Item              (id, chapterId, type, title, body, itemDate?)

TimelineEvent     (id, userId, title, date, description?, type?, bookId?, isGoal, goalStatus?)
Note              (id, userId, content, createdAt, updatedAt)

Photo             (id, userId, storagePath, originalName, mimeType, size, caption?, visibility)
File              (id, userId, storagePath, originalName, mimeType, size, visibility)

VisitedCountry    (id, userId, countryCode, visitedDate?, notes?, status: visited|future)

PrivacySetting    (id, entityType, entityId, userId, visibility: PRIVATE|SHARE_ONLY|PUBLIC)
ShareLink         (id, userId, token, createdAt, revoked)

-- Phase 6+ only, do not create early:
MailboxItem       (id, userId, type, payload, read, createdAt)
-- Phase 7+ only, do not create early:
PublicProfile / ProfileDiscovery / ProfileVisit / Notification
```

**Relationships:**
```
User → Profile, Books, TimelineEvents, Notes, Photos, Files, VisitedCountries, PrivacySettings
Book → Chapters → Items
TimelineEvent → Photos, Files, Book association
Goal = TimelineEvent(isGoal=true) → resolves into a normal past event
Photo/File → Storage object (local path in dev, Supabase Storage path after deploy)
ShareLink → User
```

### D.3 Privacy enforcement (server-side, mandatory)
For every protected read:
```
Is requester the owner?           → YES: allow
Is there a valid share token       → YES: allow only Share-only-marked content
  covering this content?
Is content PUBLIC?                 → YES: allow (Phase 7+ only)
Otherwise                          → DENY / omit entirely from response
```
Never rely on hiding private data in the React layer — unauthorized data must never reach the
browser in the first place.

### D.4 Local-first dev environment (per your preference: local now, deploy at the end)
- **Database:** local PostgreSQL via Docker Compose (agent can generate the compose file;
  you install Docker Desktop yourself).
- **File storage:** local disk, e.g. `backend/uploads/{userId}/gallery|files/`, served via a
  static/authenticated route. Implement this behind a `StorageService` interface
  (`saveFile`, `getFile`, `deleteFile`) from day one so swapping the implementation to
  Supabase Storage at deployment is a one-file change, not a rewrite.
- **Auth:** simple email/password with bcrypt + JWT for dev, behind an `AuthService`
  interface, so it can later be swapped for Supabase Auth without touching business logic —
  or kept as-is if you decide you don't need Supabase Auth's extra features.
- **Image handling:** compress and resize images client-side before they ever reach the
  backend (even in local dev) — this is a habit worth building early, not a deployment-only concern.

### D.5 Backend module list
```
auth, users, profiles, books, chapters, items, timeline, goals, notes,
gallery, files, map, privacy, sharing
-- added in Phase 6: mailbox, notifications
-- added in Phase 7: public-profiles, discovery
```

### D.6 Frontend structure
```
src/
├── components/
│   ├── room/        Room, Mirror, Bookshelf, Clock, Window, Map, Mailbox, PrivacyKey, PhotoFrame
│   ├── mirror/       (identity, notebook, gallery sub-views)
│   ├── library/       (books/chapters/items)
│   ├── timeline/
│   ├── gallery/
│   ├── map/
│   └── sharing/
├── hooks/
├── services/          (API clients, StorageService/AuthService abstractions used client-side too)
├── types/
├── utils/
└── pages/             (plain, room-less versions of every feature — used through Phase 2)
```

### D.7 Core rule for the AI agent
The room must never be hardcoded to one person's data:
```
BAD:   <Book title="Career" />
GOOD:  fetch books from API → render <Book> per result (default + custom together)
```
Same rule applies to timeline events, photos, countries, frames, and (later) mailbox items.

---

## PART E — Phased Roadmap (build in this order; each phase has a definition of done)

### Phase 0 — Skeleton
- Scaffold Vite React app + NestJS app, install Tailwind or set up CSS Modules (your call —
  original design assumed CSS Modules; either works, just decide once and stick to it)
- Prisma schema for D.2's Phase-0/1 entities; local Postgres via Docker Compose
- Local email/password auth (bcrypt + JWT) behind an AuthService interface
- **Done when:** you can sign up, log in, and see an empty authenticated dashboard running locally.

### Phase 1 — Core data, plain UI (no room graphics)
- Profile CRUD, Books/Chapters/Items CRUD incl. custom books, Timeline CRUD with
  auto-sort + gap tooltips, Notes, Photo upload to local disk with client-side compression,
  privacy toggle (Private/Share-only) on every relevant entity
- **Done when:** LIFE is fully usable in plain, unstyled UI — you use it yourself for real for
  a few days to surface data-model gaps before any visual work begins.

### Phase 2 — Goals + Timeline search
- Goal creation (isGoal=true events), "did you accomplish this?" check on page load
  (Yes/Not yet/Reschedule), timeline date-jump and text search
- **Done when:** goals correctly convert to past events and the timeline search works on a
  timeline with 50+ dummy events.

### Phase 3 — Sharing
- Share link generation/revocation (crypto-random token), token-gated read-only view that
  enforces Part D.3 server-side
- **Done when:** an incognito window with the share link shows only Share-only content, nothing else.

### Phase 4 — Visual proof of concept
- Decide the illustration approach (fully hand-drawn SVG vs. a sourced isometric room kit
  sliced into layers) before writing any component
- Build exactly two interactive room objects end-to-end — recommended: Bookshelf + Clock —
  wired to real Phase 1–3 data, with real hover/click animation
- **Done when:** you're genuinely happy with how these two look and animate. If not, change
  approach now, before building the rest of the room.

### Phase 5 — Full room + Map/Gallery/Frames
- Remaining room objects: Mirror (identity/notebook/gallery), Map with VisitedCountry data,
  Photo frames pulling from Gallery, Privacy Key UI
- Parallax layering (B.3), room entrance animation, mobile simplified layout (B.5)
- **Done when:** every feature from Part C has a room-based entry point, and mobile is usable
  (not necessarily beautiful yet).

### Phase 6 — Deployment migration + Mailbox
- Create Supabase project; migrate Postgres schema and existing local data
- Swap StorageService implementation to Supabase Storage; swap AuthService to Supabase Auth
  if desired (or keep custom auth — your call at this point)
- Deploy frontend to Vercel, backend to Render
- Only now: build minimal Mailbox (C.8) if still wanted
- **Done when:** the app works in production identically to local, with no data loss from the migration.

### Phase 7 — Polish + future features
- Window lighting by local time (B.6)
- Micro-interactions, empty/loading states, room-lighting refinement
- Write it up: README with screenshots/GIF, short blog post — for portfolio purposes, a
  documented, deployed Phase 1–3 app is worth more than an undocumented, unfinished Phase 5 app
- Public profile discovery (C.9) — only if you still want it, and only after everything above is solid

---

## PART F — Manual setup checklist (things the agent cannot do for you)

1. Install Node.js LTS, Git, a code editor, and Docker Desktop yourself.
2. Create the GitHub repo yourself (or authorize the agent's `gh` CLI if it has one).
3. For Phase 0–5: no external accounts needed at all — everything runs locally.
4. At Phase 6: create the Supabase account/project yourself, copy the API keys into a local
   `.env` file yourself (never let the agent invent or guess a secret).
5. At Phase 6: create Vercel and Render accounts yourself, connect the repo, set environment
   variables in their dashboards yourself.
6. Throughout: any subjective call ("does this look good," "is this the right illustration
   style," "is this UX confusing") is yours to make — treat agent output as a draft to review,
   not a final answer.
