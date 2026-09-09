# LIFE

**A private place to keep a life — entered through a room you can walk into.**

Most personal-archive software is a database with a form on top. LIFE is a Victorian study
rendered in the browser, where every kind of record is an object you open: a bookshelf for your
writing, a longcase clock for your timeline, a mirror for who you are, a map for where you have
been, a frame for your photographs, and a post box outside for letters to other people.

Nothing is filed in a menu. You open the thing itself.

> **Live:** _add your deployed URL here_
> **Tour:** the app introduces itself on first login, and the tour can be replayed any time.

<!-- Add 2–3 screenshots here: the room, a paper panel open over it, and the login card. -->

---

## Contents

- [The idea](#the-idea)
- [Features](#features)
- [Engineering worth a look](#engineering-worth-a-look)
- [Stack](#stack)
- [Architecture](#architecture)
- [Running it locally](#running-it-locally)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## The idea

A life is not a list of records, so it should not look like one. The whole design follows from
that: the interface has **no navigation bar, no settings page and no dashboard**. There is a
room, there are objects in it, and content opens as sheets of paper resting on top — the room
stays visible behind, so you never leave the world you are in.

The second idea is that **privacy is the default and is enforced on the server**. Data you have
not shared is never sent to a browser at all — not sent and hidden, not sent and filtered.
Never sent.

---

## Features

### The room

An interior generated **entirely from code**. No 3D models, no photographs of materials, no
downloaded environment maps — every surface is procedurally drawn at load time.

- **Time of day.** The room reads your own clock. Morning is cool and low, afternoon bright,
  sunset amber, night blue with the lamp lit. No weather API — your evening looks like evening.
- **Working curtains.** Drag one across and the room genuinely darkens; the daylight is a real
  light source, not a picture.
- **A light switch** for the pendant lamp.
- **A swinging pendulum**, a mirror with live reflections, and a camera that drifts slightly
  with your cursor so the space feels inhabited.
- Clicking an object walks the camera toward it before its document opens.

### The library — bookshelf

Long-form writing, organised by subject.

- **Books → chapters → free text.** A book is a subject ("Travels", "Family"); a chapter is a
  page you write on. Deliberately only three levels deep.
- **A physical shelf with a real limit.** Sixteen volumes stand on it; the rest live in the full
  library, and you choose which are out.
- The chosen books are **rendered on the 3D shelf**, sized and coloured from a hash of their id
  so the arrangement never reshuffles.
- Chapters autosave about a second after you stop typing.
- Per-book privacy.

### The timeline — longcase clock

- Moments in order, as rungs on an engraved scale.
- **The real elapsed time between entries is shown on the connectors** — "3 years, 2 months" —
  so the shape of a life is legible at a glance.
- **Goals** are dated forward and drawn hollow. When one comes due the timeline asks whether you
  managed it, and records achieved, missed or rescheduled.
- Search, and jump to a date.
- Whole-timeline privacy: shared entire or not at all.

### The mirror

Three things you decide about yourself.

- **Identity** — the plain record: name, date of birth, birthplace, nationality, languages, and
  a **changeable, unique username**.
- **Notebook** — private notes that are **always private**. There is no sharing control, and no
  code path that could share one.
- **Sharing link** — cut a key to your room, choose how long it lasts (a week, a month, a year,
  or forever), copy it, revoke it.

### The album — photo frame

- A **bound album you leaf through**, two prints to a spread, held on the page by paper corners,
  with a real page turn: one leaf lifts, swings on the spine and lands face-down.
- Captions are **always editable** — click and type, no edit mode.
- Per-photograph privacy.
- One photograph is **hung in the room's wall frame** and is what a visitor sees first.
- Images are **compressed in the browser** before upload.

### The map

- **All 197 countries**, searchable and grouped by region.
- **Been** (filled pin) and **still to come** (hollow pin), each with a date and notes.
- Pins appear on the wall map in the room as well as the paper chart.
- Whole-map privacy.

### Outside, and the post box

- **The window is a door.** Click the glass and you step into the garden: a path, hedges, gate
  piers, your own house with **your window lit if your lamp is on**, and a night sky with stars.
- **A post box on a stand.** Its flag stands up when post is waiting, and letters are visible
  inside it.
- **Letters are addressed by username, never by email** — so you can be written to without
  handing out your address. The name is checked as you type.
- **An invitation can be enclosed with a letter**: tick a box and the server attaches a key to
  your room, so the reader can let themselves in without anyone copying a link about.

### Visiting

- A share link opens **the room itself**, not a summary of it — the same objects, the same
  documents, read-only.
- **Objects the owner did not share simply do not open.** They are furniture.
- The visitor's panels are separate read-only components rather than the owner's panels with a
  flag, so there is no branch that could accidentally render an edit control.

### Accounts

- Email and password, **bcrypt** hashed, with **email verification** before first login.
- Login by **either** username or email.
- **Password reset** — single-use, one-hour token.
- **Rate limiting** on every route that can be abused.
- Usernames are unique, case-insensitively, and changeable.

---

## Engineering worth a look

Six things that were not obvious.

**1. Privacy is a database concern, not an interface one.**
The shared view builds its payload from queries that only ask for rows marked shared. A review
turned up the timeline and profile being fetched in full and *then* discarded if private —
nothing leaked, but the guarantee was accidental rather than enforced. Visibility is now checked
before the queries run, so what will not be sent is never loaded.
→ `backend/src/sharing/sharing.service.ts`

**2. Every texture is generated, not downloaded.**
Seeded noise → fractal noise → wood grain, plaster, velvet, paper, gilt. Normal maps are
derived by running a Sobel filter over the height data. Roughly 1,500 lines, all cached by
parameter.
→ `frontend/src/room/textures.ts`

**3. A page turn is a geometry problem, not an animation one.**
A 180° rotation about an edge always ends up outside the box it started in — which is why every
real flipbook is a two-page spread. Understanding that changed the fix from the animation to
the layout. Built rather than installed, because the obvious library is unmaintained and
declares its own dependency as `"latest"`.
→ `frontend/src/components/paper/PageTurn.tsx`, written up in [PAGE-TURN.md](docs/PAGE-TURN.md)

**4. Never add or remove lights at runtime.**
Flicking the light switch froze the app for a second: changing the number of lights in a scene
makes Three.js recompile every material's shader. The lamp is now always mounted and dimmed to
zero.

**5. The storage layer has one seam.**
Three backends — local disk, the database, or any S3-compatible bucket — chosen by environment
variables, with nothing outside that file aware of which is in use. It earned its keep twice:
serverless hosting has no persistent filesystem, and every object-storage free tier now wants a
payment card, so being able to fall back to the database without touching application code was
the difference between deploying and not.
→ `backend/src/storage/storage.service.ts`

**6. Three dependencies were rejected on inspection.**
`@nestjs/throttler` (no NestJS 12 support), `react-pageflip` (unmaintained, no React 19, pins
nothing), and Supabase (its free tier pauses the whole project after a week idle, which would
break a demo link). Each was replaced with something written or chosen deliberately, and the
reasoning is recorded.

---

## Stack

**Frontend**
React 19 · TypeScript · Vite · Three.js via React Three Fiber · Tailwind CSS v4 ·
Motion · React Router · axios

**Backend**
NestJS 12 · TypeScript (ESM) · Prisma 6 · PostgreSQL · Passport JWT · bcryptjs · Nodemailer

**Infrastructure**
Vercel (frontend and serverless API) · Neon (Postgres) · SMTP, provider-agnostic ·
photograph storage in the database or any S3-compatible bucket ·
Docker Compose and Mailpit for local development

---

## Architecture

```
LIFE/
├── backend/                  NestJS API
│   ├── prisma/               Schema and migrations
│   ├── api/index.ts          Serverless entry point
│   └── src/
│       ├── auth/             Signup, login, verification, reset, usernames
│       ├── common/           Rate-limit guard
│       ├── privacy/          The visibility model
│       ├── sharing/          Share links and the visitor payload
│       ├── storage/          Disk or object storage, one seam
│       └── …                 books, chapters, timeline, gallery, map, notes, mailbox
│
└── frontend/src/
    ├── room/                 The 3D world: scene, shell, objects, textures, outside
    ├── components/paper/     Document panels and the page turn
    ├── components/auth/      The Victorian entrance card
    ├── pages/                Routed screens
    ├── services/             Every API call, in one place
    └── data/                 The country list
```

Each backend feature is a **controller** (URLs), a **service** (the work) and **DTOs** (the
shape of what may be sent). A request passes the rate-limit guard, then the auth guard, then
validation, before any code of ours runs.

The 3D bundle is **code-split and lazy-loaded**, so the login screen never downloads a 3D
engine it will not use.

---

## Running it locally

**You need:** Node 20+, Docker.

```bash
git clone <your-repo-url> && cd LIFE

# 1. Postgres and a mail trap
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # works as-is for local development
npm install
npx prisma migrate deploy
npm run start:dev             # http://localhost:3000

# 3. Frontend (a second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Then register an account. **Verification email arrives at http://localhost:8025** — Mailpit
catches all outgoing mail so nothing reaches a real inbox during development.

---

## Deployment

Everything runs on permanently free tiers. Step-by-step instructions, every environment
variable, and what to check when something is wrong: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Documentation

| Document | What is in it |
|---|---|
| **[PAGE-TURN.md](docs/PAGE-TURN.md)** | How a realistic page turn works, why flipbook sites are built the way they are, and how to do it in any framework |
| **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Deploying free, and why each service was chosen |
| **[LIFE_master_spec.md](docs/LIFE_master_spec.md)** | The original product specification |

---

*Concept, specification and design direction by Nadine Mlayeh.*
