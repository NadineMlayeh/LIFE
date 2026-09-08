# Understanding LIFE

A walk through your own codebase, in plain language.

The goal is that you can open any file and know why it is the way it is — and answer a question
about it without hesitating. The last section is twenty questions someone might actually ask,
with answers.

**Contents**

1. [What LIFE is](#1-what-life-is)
2. [The shape of the project](#2-the-shape-of-the-project)
3. [The backend](#3-the-backend)
4. [The database](#4-the-database)
5. [Privacy — the most important idea](#5-privacy--the-most-important-idea)
6. [The frontend](#6-the-frontend)
7. [How Three.js works](#7-how-threejs-works)
8. [How the room is built](#8-how-the-room-is-built)
9. [The paper panels](#9-the-paper-panels)
10. [Decisions, and what was rejected](#10-decisions-and-what-was-rejected)
11. [Twenty questions](#11-twenty-questions)

---

## 1. What LIFE is

A private web application that holds one person's life as a single connected world, entered
through a 3D Victorian room.

Every kind of record is an **object you open**, not a menu item:

| Object | Holds |
|---|---|
| Bookshelf | Books → chapters → free writing |
| Longcase clock | Timeline of moments and goals |
| Mirror | Identity record, private notebook, share keys |
| Wall map | Countries visited and countries wanted |
| Photo frame | Photograph album |
| Window | The way outside |
| Post box (outside) | Letters between users |

Clicking an object opens a **sheet of paper** over the room — never a new page. The room stays
behind it, so you never leave the world.

**Roughly 13,700 lines of frontend and 2,600 of backend.**

---

## 2. The shape of the project

```
LIFE/
├── backend/          NestJS API + Postgres
│   ├── prisma/       Database schema and migrations
│   ├── src/          One folder per feature
│   └── api/          Serverless entry point (production)
├── frontend/         React + Vite
│   └── src/
│       ├── room/     Everything 3D
│       ├── components/paper/  The document panels
│       ├── pages/    Routed screens
│       ├── services/ API calls
│       └── data/     The country list
└── docs/
```

**Why two separate projects?** The frontend is files a browser downloads; the backend is code
that runs on a server with database access. They speak over HTTP and know almost nothing about
each other — the frontend only knows the shape of the JSON it receives. Either could be
replaced without touching the other.

---

## 3. The backend

**NestJS** — a framework for structuring a Node.js server. Its value is that it forces the same
shape on every feature, so a folder you have never opened is laid out like every other.

Each feature folder has the same three files:

- **Controller** — the URLs. "A `POST` to `/books` means call this function." Nothing else.
- **Service** — the actual work. Talks to the database, enforces rules.
- **DTO** — *Data Transfer Object*: the shape of what the outside world may send. A title is a
  string of at most 120 characters; anything else is refused before it reaches your code.

Why split them? Because "what URL is this" and "what should happen" are different questions.
When routing changes you touch controllers; when rules change you touch services.

### The request path

`POST /books  { "title": "Travels" }`

1. **`RateLimitGuard`** — has this caller made too many requests? If so, `429` and stop.
2. **`JwtAuthGuard`** — is there a valid token? It carries a user ID. If not, `401` and stop.
3. **`ValidationPipe`** — does the body match `CreateBookDto`? If not, `400` and stop.
4. **Controller** — routes it to `books.service.create(user.id, dto)`.
5. **Service** — writes the row, stamped with *that* user's ID.
6. Response.

The important part is that **the user ID never comes from the request body**, only from the
verified token. Otherwise anyone could write a book into anyone's account by sending someone
else's ID.

### The guards

A **guard** decides whether a request may proceed. Two of them:

**`JwtAuthGuard`** — JWT means *JSON Web Token*. At login the server sends a signed string.
The browser stores it and attaches it to every request. The server verifies the signature with
`JWT_SECRET` and trusts the user ID inside.

The point: the server stores **nothing** about who is logged in. It does not need to look up a
session — the token proves itself. That is what lets the API run as a serverless function with
no memory between requests.

**`RateLimitGuard`** — you wrote this one rather than installing it, because
`@nestjs/throttler` does not support NestJS 12. Each caller gets a counter per route; past the
limit, `429`. Login allows 8 attempts per 15 minutes.

Without it, a script can try thousands of passwords a minute. **A limit is the difference
between a lock and a lock nobody can pick at speed.**

---

## 4. The database

**Postgres**, through **Prisma**.

Prisma is an **ORM** — Object-Relational Mapper. You describe tables in `schema.prisma`, and it
generates a typed client:

```ts
await prisma.book.findMany({ where: { userId } })
```

instead of writing SQL. The real benefit is **type safety**: if you rename a column and forget
to update a query, TypeScript fails the build rather than the app failing at 3am.

### Migrations

A migration is a recorded change to the database's structure. `prisma/migrations/` holds them
in order, and running them in sequence on an empty database produces the current schema.

That is what makes production safe: the same steps that ran locally run there, in the same
order. On deployment `prisma migrate deploy` applies any not yet applied.

### The tables

**`User`** — email, `username`, `usernameLower`, `passwordHash`.

Passwords are stored **hashed with bcrypt**, never as text. Hashing is one-way: you can check a
guess but cannot reverse it. If the database leaked, the passwords would not.

`usernameLower` exists so `Nadine` and `nadine` cannot both register. Postgres is
case-sensitive, so a second lowercase column is the standard way to enforce that.

**`Book` → `Chapter`** — a book has chapters; a chapter holds free text in `content`.

There was once a third level (`Item`) between chapter and content. It was removed: a chapter is
something you *write*, not a list of things. Removing it meant a migration that folded the
existing entries into their chapter's text so nothing was lost.

**`TimelineEvent`**, **`Photo`**, **`Note`**, **`VisitedCountry`**, **`Letter`** — one row per
thing, each carrying `userId`.

**`ShareLink`** — a random token, an optional `expiresAt`, and a `revoked` flag.

**`PrivacySetting`** — see below.

### Indexes

An index is a lookup structure that lets the database find rows without reading the whole
table. Every foreign key here is indexed (`@@index([userId])`), because every query filters by
owner. Without them, "this user's books" would scan every book of every user.

---

## 5. Privacy — the most important idea

**Private data is never sent to the browser.**

That sounds obvious and is routinely got wrong. The common approach is to send everything and
hide the private parts in the interface. That is not privacy — anyone can open the network tab
and read it. It is a curtain, not a wall.

Here, the database query itself only asks for shared rows.

Two kinds of switch:

- **Per object** — each book has its own seal.
- **Whole object** — the timeline, the map and the identity record are all-or-nothing. Sharing
  "some of your timeline" is a distinction without a difference: the shape of a chronology is
  the thing being shared.

**Notes have no control at all.** They are always private, and there is no code path that could
share one. A control you cannot use wrongly is safer than one you must remember to set.

### The bug found in review

`getSharedView` originally fetched every timeline event and the whole profile in one parallel
batch, then discarded them in JavaScript if the switch turned out private. Nothing leaked — but
the guarantee was *aspirational*. While private rows sit in memory, any future change to how
the response is built can expose them.

It now reads the visibility switches **first**, and only queries what is actually shared. One
extra round trip; the guarantee becomes true rather than intended.

**Worth being able to tell this story.** It shows the difference between code that works and
code that is correct.

### Unauthorized returns 404, not 403

Asking for a book that is not yours gives *"not found"*, not *"forbidden"*. `403` confirms the
thing exists — which is itself information. `404` reveals nothing.

---

## 6. The frontend

**React + Vite + TypeScript.**

- **React** builds interfaces from components. You describe what the screen should look like for
  some data, and React works out what to change in the page.
- **Vite** is the build tool — a dev server with instant reloads, and a bundler for production.
- **TypeScript** is JavaScript with types. `title: string` is checked at build time.

### Folders

- **`room/`** — everything 3D.
- **`components/paper/`** — the document panels.
- **`components/auth/`** — the Victorian login card.
- **`pages/`** — screens with a URL.
- **`services/`** — every API call, in one place. No component uses `fetch` directly, so
  changing where the API lives is one file.
- **`hooks/`** — `useAuth` holds who is logged in.

### Code splitting

Three.js is large — the room's bundle is about **272 KB gzipped**. If it were in the main
bundle, the login page would wait for a 3D engine it never uses.

`App.tsx` loads the room **lazily**: React downloads that chunk the first time someone opens
`/room`. The front door stays fast.

---

## 7. How Three.js works

Genuinely simple once the vocabulary lands. Four things:

**Scene** — the world. A container for everything.

**Camera** — where you stand and which way you face.

**Mesh** — a visible object. Every mesh is exactly two things:
- **Geometry**: the shape (its corners and how they join).
- **Material**: how the surface responds to light (colour, roughness, metalness).

**Lights** — without them a `MeshStandardMaterial` renders black.

The renderer takes the scene and camera sixty times a second and draws it.

### React Three Fiber

Writing that by hand is verbose. **React Three Fiber** lets you write 3D as React:

```tsx
<mesh position={[0, 1, 0]}>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="#8A6038" roughness={0.6} />
</mesh>
```

That is a box, one metre cubed, one metre up, in brown. Same objects underneath — React just
manages them.

**`useFrame`** runs a function every frame. The clock's pendulum, the mailbox door opening, the
camera drifting with your cursor — all `useFrame`.

### Materials, in one paragraph

`MeshStandardMaterial` is *physically based*: rather than "how bright is this", you set what
the surface *is*.

- **`roughness`** — 0 is a mirror, 1 is chalk.
- **`metalness`** — 0 is wood or paint, 1 is bare metal.

This is why the gilt frames work. Gold is not a colour, it is **a metal**: `metalness` near 1
and low roughness. Painted flat yellow it looks like plastic, however yellow you make it.

### Texture maps

A texture is an image wrapped onto a surface. Three kinds are used here:

- **`map`** — the colour.
- **`normalMap`** — fakes bumps. It encodes which way each point *faces*, so light reacts as if
  there were grain and dents on a surface that is geometrically flat. Cheap, and does most of
  the work of making wood look like wood.
- **`roughnessMap`** — varies shine across a surface, so it is not uniformly polished.

---

## 8. How the room is built

### Nothing is downloaded

No Blender models, no photographs of wood, no HDR environment maps. Every texture is **drawn in
code** at load time.

`room/textures.ts` (~1,500 lines) is the engine. The chain:

1. **A seeded random number generator.** "Seeded" means the same seed gives the same sequence
   every time, so a shelf never reshuffles between reloads.
2. **Value noise** — smooth random blotches.
3. **Fractal noise (fbm)** — several octaves of noise stacked: big shapes plus fine detail.
   This is how almost all natural texture is generated.
4. **Material generators** — `createWoodMaps` turns that noise into rings; `createPlasterMaps`
   into a rough render; `createVelvetMaps` into cloth.
5. **Normal maps from height** — a Sobel filter measures how steeply the brightness changes at
   each pixel and converts that slope into a direction. Bright-to-dark becomes a bump.

Everything is **cached by its parameters**, so two oak objects share one texture.

### Why it was worth doing

The brief said the room must come from code alone. It also means: no assets to host, no
licences, and every object guaranteed to belong to the same world because they are all made by
the same functions.

### The lessons that took several attempts

These are the interesting part, because each was a wrong answer first.

**1. Flat colour on a large surface reads as plastic.** The first grass was one green on a
plane and looked like Minecraft. Real grass is thousands of blades at different angles. It is
now 9,000 short strokes over mottled patches.

**2. Cloth is mostly shadow.** The first curtains sat in mid-browns and looked cheap. Velvet in
a dark room goes nearly black in the creases and catches a bright sheen only on the ridges. The
drape is drawn dark first and lit afterwards — **not** coloured and then shaded.

**3. Nothing organic may repeat.** Equal fold widths make a fence. Widths, tones, sheen and
where the ridge falls all vary from a hash.

**4. No hard ornament in a soft scene.** A gold tieback cord, a scalloped pelmet and a swag's
rope were each tried and each read as *a flat line ruled over the picture* — because a stroke
has no shading and everything around it does. **A single stroke of colour cannot sit in a scene
built out of soft gradients.**

**5. Soft edges.** Crisp boundaries between gradients read as printed stripes. The whole shading
layer is blurred; softness is what turns bands into folds.

### Time of day

`room/timeOfDay.ts` reads the visitor's clock and returns a lighting description — sun colour,
intensity, position, sky colours. Morning is cool and low; afternoon bright; sunset amber;
night blue with the lamp on.

No weather API, no server call. **Your evening looks like evening.**

### The freeze bug worth knowing

Flicking the light switch froze the app for a second. Cause: the lamp's light was being *added
and removed*, and changing the number of lights in a scene makes Three.js recompile every
material's shader.

Fix: the light is **always mounted** and its intensity set to zero. Never add or remove lights
at runtime — only change intensity.

### Outside

`OutsideScene.tsx` is a **separate scene**. Modelling the room and garden as one space would
mean carrying the room's geometry and lights around while standing outdoors, for a view that
never sees them. Only the world you are in is mounted.

---

## 9. The paper panels

Every document uses `Panel.tsx`: a sheet with a gilt frame that settles over the room.

Rules learned the hard way:

**A panel must never be taller than the window.** Removing the height cap made the sheet grow
past the viewport; because it is centred, the header became physically unreachable.

**`flex-1` silently overrides an explicit `height`.** In a flex column, `flex: 1 1 0%` zeroes
the basis and lets the item grow. The fixed-height option was being set and ignored. A
fixed-height flex child needs `shrink-0`.

**A panel's first view must never scroll.** Everything it opens with has to fit; scrolling is
what happens later, once you have typed past the bottom. The saving control is what to measure
against — Record and Send must never be below the fold.

**Confirmations use a portal.** Two earlier attempts failed oppositely: a popover inside the
panel was clipped by `overflow-hidden`, and an inline strip shoved its neighbours sideways. A
portal renders outside the panel's DOM, so it escapes the clipping *and* takes no layout space.

### The page turn

`PageTurn.tsx` gives the album a real turn. Worth understanding because the reasoning is nice:

**Only one page moves.** In a real book the next page is not arriving — it has been lying there
the whole time. The page you are reading lifts and swings; what was underneath is uncovered.

**Four pages are on screen during a turn.** Going from 2|3 to 4|5: page 2 stays, page 3 is the
front of the turning leaf, **page 4 is its back**, and page 5 is revealed. That is why books are
bound in spreads — and why the component addresses pages *by index* rather than taking
children. A snapshot cannot express two halves belonging to different spreads.

**The geometry that decides the layout:** a 180° rotation about an edge always ends up outside
the box it started in. A spread gives the leaf somewhere to land.

Full write-up in [PAGE-TURN.md](PAGE-TURN.md), including why the ready-made library was
rejected.

---

## 10. Decisions, and what was rejected

| Decision | Why | What was rejected |
|---|---|---|
| Three.js over 2.5D | The brief wanted a real room, and depth had to be genuine | Layered illustrations |
| Everything procedural | No assets, no licences, one coherent world | Blender models, sourced textures |
| Privacy in the query | Hiding data client-side is not privacy | Filtering in the interface |
| Notes always private | A control you cannot misuse | A per-note toggle |
| Custom rate limiter | `@nestjs/throttler` does not support NestJS 12 | Forcing an unsupported version |
| Custom page turn | `react-pageflip` is unmaintained, has no React 19 support, and pins nothing | The library |
| Username, not email | Email must never be how people find you | Addressing letters by email |
| Read-only visitor panels | A flag threaded through editors is one missed branch from a bug | `readOnly` props |
| Serverless API | Free hosting for always-on servers has gone | Render free (sleeps 15 min) |
| Neon over Supabase | Supabase free pauses the whole project after a week | Supabase |

**The pattern worth noticing:** three of those are *refusals to install something*. Each was
rejected for a stated, checkable reason — not preference. That is a defensible engineering
position and a good thing to be asked about.

---

## 11. Twenty questions

### Architecture

**1. Walk me through what happens when someone logs in.**

The browser posts the identifier and password to `/auth/login`. The rate-limit guard checks the
caller has not exceeded 8 attempts in 15 minutes. The service finds the user by email *or*
username, compares the password against the bcrypt hash, and checks the email is verified. If
all pass it signs a JWT containing the user ID and returns it with the user. The browser stores
it and an axios interceptor attaches it to every later request.

Notably the failure message is identical for "no such account" and "wrong password" — otherwise
the form becomes a way to discover which addresses are registered.

**2. Why separate frontend and backend rather than one Next.js app?**

The frontend is a heavy 3D client that could be a desktop app tomorrow; the backend is a
stateless API. Keeping them apart means the API has no opinion about who calls it, and the
boundary is enforced by HTTP rather than convention. The cost is CORS configuration and two
deployments.

**3. What is a JWT and why use one?**

A signed token carrying the user ID. The server verifies the signature rather than looking up a
session, so it stores nothing about who is logged in — which is what lets the API run as a
serverless function with no memory between requests.

The trade: you cannot revoke a JWT before it expires. Ours last 7 days. For anything with real
consequences I would add a refresh-token pair so the short-lived one can be invalidated.

**4. Where do you store the token, and what is wrong with that?**

`localStorage`. It is readable by any script on the page, so a cross-site-scripting bug would
expose it. The safer option is an httpOnly cookie the browser attaches automatically, which
JavaScript cannot read — but that needs CSRF protection and same-site configuration across two
domains. For a personal app with no third-party scripts I took the simpler option knowingly.
I would not make that choice with other people's data at stake.

**5. How does the API know a request is for the right user?**

The user ID comes only from the verified token, never from the request body, and every query
filters on it. `findFirst({ where: { id, userId } })` — asking for someone else's book returns
nothing rather than someone else's book.

### Privacy

**6. How does sharing work?**

A share link is 32 random bytes. Opening it returns a payload assembled from queries that only
ask for rows marked `SHARE_ONLY`. Private rows are never loaded — so there is nothing in the
browser's hands to leak, even if the interface had a bug.

**7. Why 404 instead of 403 for something that is not yours?**

`403` confirms the thing exists, which is itself information. `404` tells an attacker nothing.

**8. Someone finds a share link. What can they see?**

Only what was explicitly shared, and only until it lapses or is revoked. Links now expire by
default. Notes can never appear — there is no code path that would share one.

**9. Tell me about a bug you found in your own code.**

The shared view fetched every timeline event and the whole profile, then discarded them if the
privacy switch said private. Nothing leaked, but the guarantee the privacy model rests on was
only true by accident: while private rows are in memory, any change to how the response is
assembled could expose them. I moved the visibility check before the queries so the data is
never fetched. It costs one extra round trip.

**10. Why can notes never be shared?**

Because the safest control is one that does not exist. Every optional privacy setting is a
setting someone can get wrong once.

### Frontend and 3D

**11. Why Three.js rather than images?**

The concept is a room you are inside, and depth had to be real — the camera moves toward an
object when you click it. Layered images cannot do that. The cost is a ~272 KB gzipped bundle,
which is why it is loaded lazily.

**12. How is the room textured with no image files?**

Seeded noise, drawn to a canvas at load time. Value noise stacked into fractal noise, then
shaped into rings for wood or a rough surface for plaster. Normal maps come from running a
Sobel filter over the height data. Everything is cached by its parameters.

**13. What did you learn about making 3D look real?**

That the failures share a cause: **not enough variation.** Flat colour on a big surface, box
geometry for organic things, identical neighbours. Real materials vary everywhere. The most
counter-intuitive one is that cloth is *mostly shadow* — the first curtains sat in mid-browns
and looked like plastic because I lit them evenly.

**14. Anything about performance?**

Three things. The room's chunk is lazy-loaded so the login page does not download a 3D engine.
The render loop is frozen while a panel is open, since nothing behind it is moving and each
keystroke would otherwise repaint the whole scene. And textures and geometry are cached at
module level rather than in `useMemo`, because `useMemo` only lives as long as the component —
stepping between the room and the garden was rebuilding the garden every time.

**15. Why did you write your own page turn?**

`react-pageflip` was last published in 2022, has no React 19 in its peer range, and declares its
own dependency as `"latest"` — meaning two installs on different days can produce different
code. It also wants to own the page DOM, which fights live editable content. The effect is about
sixty lines of CSS 3D. The library was the bigger risk.

**16. Explain a CSS problem you had to debug.**

`backdrop-filter` did nothing on the auth card. It blurs whatever is painted *behind* the
element, and the element's parent was an opaque panel — so it was faithfully blurring a flat
colour and returning the same flat colour. Moving it to the outermost layer fixed it. Related:
a light panel over a dark room cannot look like glass at any opacity, which is why the card is
dark with light text.

### Engineering judgement

**17. What are the weaknesses of this project?**

No automated tests — the biggest one. The rate limiter is per-instance, so it resets on restart
and does not hold across multiple instances. Tokens sit in `localStorage`. There is no mobile
version. And it has only ever had one user, so none of its assumptions have been tested by
someone who did not build it.

**18. What would you do next?**

Tests first, on the privacy boundary — that the shared payload never contains an unshared book
is the single most valuable test in the codebase. Then move rate limiting to Redis, add refresh
tokens, and build mobile as its own thing rather than squeezing the room onto a phone.

**19. How would this handle a thousand users?**

The data model is fine — everything is indexed by owner and queries are per-user. The API is
serverless, so it scales by adding instances. Two things break: rate limiting is per-instance
so the effective limit multiplies, and the free-tier database connection pool would need
attention. Neither is architectural; both are configuration.

**20. What is the hardest thing you had to reason about?**

The page turn's geometry. A 180° rotation about an edge always ends up outside the box it
started in — which is why every real flipbook is a two-page spread, and why my single-page
version was clipping half the animation. Realising the constraint was geometric rather than a
CSS problem meant the fix was to change the *layout*, not the animation. That reframing is the
part I would want to be asked about.

---

## Where to look when you are asked something

| Question about | Open |
|---|---|
| Privacy | `backend/src/sharing/sharing.service.ts` |
| Auth | `backend/src/auth/auth.service.ts` |
| Rate limiting | `backend/src/common/rate-limit.guard.ts` |
| The data model | `backend/prisma/schema.prisma` |
| Textures | `frontend/src/room/textures.ts` |
| The room | `frontend/src/room/RoomScene.tsx` |
| Panels | `frontend/src/components/paper/Panel.tsx` |
| The page turn | `frontend/src/components/paper/PageTurn.tsx` and [PAGE-TURN.md](PAGE-TURN.md) |
| Storage | `backend/src/storage/storage.service.ts` |
| Deployment | [DEPLOYMENT.md](DEPLOYMENT.md) |
