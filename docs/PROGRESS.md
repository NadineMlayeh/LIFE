# LIFE — Build Progress

> **The forward plan lives in [`PLAN.md`](PLAN.md).** This file is the record of what is built
> and the reasoning behind it. Read PLAN.md for what happens next.

The plan being followed is [`LIFE_master_spec.md`](LIFE_master_spec.md), **Part E — Phased
Roadmap**. Build phases in order; do not start a phase before the previous one is done.

`LIFE_spec_v3.md` is the earlier, shorter draft, kept for reference only. Where the two
disagree, the master spec wins — it is the one with the local-first dev setup.

**Two owner decisions now override both spec documents:**

1. **The room is real 3D (React Three Fiber)**, reversing master spec B.1 and B.3. See Phase 4.
2. **The Mailbox is in scope**, reversing C.8 / v3 §1 — letters exchanged between LIFE
   accounts. Built, and still deliberately minimal: no threads, no attachments, no feed.

---

## Phase 0 — Skeleton ✅ done

- [x] Vite + React + TypeScript frontend, NestJS + TypeScript backend
- [x] Local Postgres via Docker Compose
- [x] Prisma schema for the Phase 0/1 entities + migrations
- [x] Email/password auth (bcrypt + JWT)
- [x] Signup, login, empty authenticated dashboard

**Added beyond the spec:** email verification with single-use, 24-hour expiring tokens,
delivered over SMTP to Mailpit locally.

## Phase 1 — Core data, plain UI ✅ code complete (awaiting real-world use)

- [x] Profile (Civil Identity) CRUD
- [x] Books / Chapters / Items CRUD, including custom books
- [x] Default books seeded per user, served from the API (never hardcoded in the UI)
- [x] Timeline CRUD with server-side auto-sort by date
- [x] Timeline normalized spacing + gap tooltips (spec C.3.1 / C.3.2)
- [x] Notes (free-form notebook)
- [x] Ownership enforced server-side on every query; cross-user access returns 404
- [x] Photo upload to local disk, behind a `StorageService` interface
- [x] Client-side image compression + resize before upload (max 1600px, JPEG q0.82)
- [x] Privacy toggle (Private / Share-only) on books, timeline events, photos
- [ ] **Use it yourself for a few days** — the actual definition of done

**Definition of done:** LIFE is fully usable in plain UI, and *you have used it yourself for
real for a few days* to surface data-model gaps before any visual work begins. The code is
there; the using-it part is not something an agent can do for you.

## Phase 2 — Goals + Timeline search ✅ done

- [x] "Did you accomplish this?" prompt, checked when the timeline loads (no notifications)
- [x] Yes / Not yet / Reschedule, with reschedule re-sorting the goal to its new position
- [x] Achieved goals render as completed past events
- [x] Timeline text search (title + description, case-insensitive, server-side)
- [x] Date-jump: scrolls to the nearest event in either direction and highlights it
- [x] Verified against a 56-event timeline

`node scripts/seed-timeline.mjs <email>` fills an account with ~56 dummy events for testing.
`--clear` removes them again (they are tagged `type = 'dummy'`).

## Phase 3 — Sharing ✅ done

- [x] Share link generation and revocation (32 random bytes → 64 hex chars)
- [x] Token-gated read-only view at `/share/:token`, no account needed
- [x] Enforced by the database query itself — private rows are never loaded, so they cannot
      leak through a later serialisation mistake (Part D.3)
- [x] Shared photos served through their own token-checked route
- [x] Verified: private books, events, notes, photos and identity never appear in the payload;
      revoked and forged tokens both 404

**Phases 0–3 are complete. This is the "boring deployed app" milestone — the portfolio-worthy
part — and everything below is presentation on top of it.**

## Phase 3.5 — Backend completeness pass ✅ done

Closing every gap between the spec and the API before the visual work starts.

- [x] **Map** — `GET/PUT /map/countries`, `DELETE /map/countries/:code`. Country code is the
      key per user (ISO alpha-2, normalised to uppercase), so toggling is idempotent.
- [x] **Files** — upload/list/download/delete, 10 MB cap, executable and script extensions
      refused, optional links to a timeline event or item.
- [x] **Mailbox** — letters between LIFE accounts: inbox, sent, unread count, mark read,
      delete. Verified accounts only; no self-letters. Deliberately not a chat system.
- [x] **Per-field identity privacy** (C.1.1) — each of the five identity fields has its own
      visibility column; the shared view assembles identity field by field.
- [x] **Attachments** (C.1.3 / C.3.5 / D.2) — photos link to events, books or items; files
      link to events or items; both filterable.
- [x] **Featured photo** — `GET /photos/featured` for the room's wall frame, falling back to
      the newest photo. Featuring one demotes the others.
- [x] Notes are now privacy-controllable and appear in the shared view.

Every backend module in spec D.5 now exists. `users` lives inside `auth` and `goals` inside
`timeline`, both as the spec intended.

## Phase 4 — Visual proof of concept 🔵 next

**Decision made (2026-09-06): React Three Fiber, not 2.5D SVG.** This deliberately reverses
master spec B.1/B.3 ("explicitly NOT full 3D", "Depth without Three.js"). Those sections are
superseded — read this table instead of them.

Reasoning: the hard constraint is **everything from code — no Blender models, no sourced SVG
illustrations, no image textures**, because the owner is not a designer and will not risk an
incoherent mashup of external assets. Under that constraint a renderer wins, because the
brief asks for believable materials, soft shadows, light falloff and reflections — which
`MeshStandardMaterial` + lighting compute for you, and which hand-written SVG would require
real illustration skill to fake.

Rules for the 3D work:

- Primitive geometry only (box, cylinder, plane, torus, lathe) — no imported `.glb`/`.gltf`
- **Procedural textures generated in code** (noise → canvas → texture) for wood, plaster and
  paper. This is the main thing separating "premium" from "toy blocks" — do not skip it.
- Lighting is the budget: warm low-angle sun through the window, soft shadows, restrained
  warm-neutral palette. `drei`'s `<Environment>` preset is allowed (ships in the package).
- Fixed diorama camera, not free-roam. Click = camera moves toward the object.
- Content (forms, notes, timeline) stays in DOM overlays — the 3D is the shell, not the UI.
- Mobile gets the simplified DOM layout, not a downscaled 3D scene.

- [x] Bookshelf, wired to real books — the hardest object to make look good, so it is the
      honest test of the whole approach
- [x] Clock, showing real local time, wired to the timeline count
- [x] Room shell: wooden floor, plaster walls, skirting, rug, window
- [x] Procedural texture library (`src/room/textures.ts`) — value noise → fbm → wood with
      growth rings/knots, plaster, paper; Sobel height→normal maps so surfaces catch light
- [x] Time-of-day lighting (spec B.6) driven by the device clock
- [x] Cursor parallax + cinematic camera moves on click, fixed diorama framing
- [x] Room lazy-loaded so the plain UI never downloads Three.js
### First review (2026-09-07) — findings from the screenshot

The two-object test did its job. What it told us:

- The room read as an **open-sided box seen from outside** — only two walls existed and the
  camera sat beyond them, so the outer edges showed against the background.
- The wood read as **rippled sand**, worst on the floor. Cause: grain distortion was ~2.2×
  larger than the ring spacing, so rings wandered more than a full period and lost all plank
  structure.
- The shelf looked **near-empty**: 11 books over 4 shelves at ~5 cm each on a 190 cm case.
- The left wall went **grey** — no bounce light reached it.
- The window frame read as **derelict Victorian**, not cosy: dark heavy timber, chunky
  cottage grid. Wanted: cared-for, painted, alive.
- Clicking an object **dumped you into a bare white form**, breaking the illusion instantly.

### Stage 1 — inside the room ✅ done

- Four walls and a ceiling; camera stands **inside** at eye height, fov 52
- The window is a **real hole** cut through the left wall, built from four boxes — previously
  the solid wall blocked all daylight
- Sun angles per phase aimed so the ray actually passes through the opening
- Background envelope and fog removed; the outside is no longer reachable by the camera

### Stage 2 — materials ✅ done

- **Plank floor generator**: discrete boards, staggered end joints, dark seams, per-board tone
  and grain phase, gently domed boards
- Wood rewritten: distortion cut to 0.55 of ring spacing, sharpened latewood bands,
  strongly anisotropic fibre so grain runs *along* the board
- **Painted joinery** material for window and skirting — cosy vintage, not weathered
- Shelf rows now **scale to fill their shelf**, so any book count looks like a used library

### Art direction (from the owner's reference image, 2026-09-07)

The reference is a render, not a realtime frame — do not chase its material density. Take the
direction, not the pixels:

- **Golden-hour light is the hero.** Low warm sun, the window's pane pattern thrown across the
  rug, warm rim-light on edges, deep shadow in corners. Already working; protect it.
- **Brass is the only accent metal** — pendant lamp, mirror frame, clock bezel, mailbox, key,
  hardware. One metal throughout is what makes a room read as curated.
- **Objects cluster, never evenly spaced.** Trinkets standing between books, a gallery wall of
  mismatched frames at varied heights. Density is what reads as lived-in.
- **Warm mid-brown polished wood**, cream textured walls, patterned rug — not a plain one.
- Architectural interest carries a lot: ceiling beams, wainscoting, a deep window reveal.
- Sheer curtains soften the window and catch the light.

Explicitly not chasing: photoreal foliage, dense small clutter, true raytraced reflections.

### Stage 2.5 — atmosphere from the reference ✅ done

- Ceiling beams + cornice; wainscot panelling and rail on two walls
- Brass pendant lamp with its own shadow-casting light, brighter at sunset and after dark
- Sheer curtains on a brass pole, transmissive so they glow when backlit
- Patterned rug drawn properly — nested borders, medallion, corner motifs, woven wear
- Trinkets among the books (globe, flat stack, brass box); the shelf layout reserves space
  for them at the right-hand end

### Bookshelf interaction model (owner's design, 2026-09-07 — not yet built)

The shelf is meant to grow with you, not display a fixed set:

1. A new LIFE starts with **one book** on the shelf.
2. **Hovering a book** reads out its title; clicking opens that book.
3. **Clicking the empty space** on a shelf opens the "add a book" interface.
4. As books accumulate they fill the shelf; the **remaining sliver of empty space stays
   clickable** as the way to add another.
5. Once the shelf is full, clicking that space shows the **whole library** — everything added,
   not just what is on display.
6. The owner **chooses which books appear on the shelf** (e.g. most recently used or edited);
   the rest live in the full library view.

Implications for the current code: the fill algorithm must stop expanding books to fill the
row once there are enough of them, and must always leave a clickable gap. Default books
seeded at signup will need rethinking against point 1.

### Stage 4 (in progress)

- [x] **Longcase clock** replacing the wall clock — plinth, trunk with glazed lenticle and a
      real seconds pendulum, hood with silvered dial, brass chapter ring and spandrels, arched
      crest with finials. Chapter ring densifies with timeline size.
- [x] **Tooled book bindings.** Ornament is *drawn*, not modelled: foliate fleurons from
      mirrored béziers, gilt fillets, bordered title label. The gilt is a white-on-black mask
      used as emissive **and** metalness map at once, so one shared texture gilds every book
      while leather colour still varies per book. Five raised cords stay real geometry.
- [x] **Draggable curtains** — grab either curtain and pull across; daylight, ambient and
      bounce all scale with how far they are drawn.
- [x] **Victorian velvet dressing** (owner reference, 2026-09-07): brown/bronze velvet drapes
      over a permanent sheer, a scalloped damask valance with bullion fringe drawn as an
      alpha-shaped texture, carved cornice, and tasselled tiebacks. The tiebacks are a
      *function of openness*, not a separate mode — they gather and fade as you drag, so
      closing a curtain stays one gesture.
- [x] **Brass light switch** on the back wall working the pendant lamp.
- [x] **Mirror** — arched pier glass in **polished gilt** with a bead course round the frame
      (dark timber read as cheap against the rest of the room). Uses drei's
      `MeshReflectorMaterial`: a real reflection pass, because a mirror that doesn't reflect
      reads as a painted panel. Its reflection shimmered until the blur was dropped and the
      resolution doubled — blurring a low-res reflection resamples different texels each
      frame as the camera drifts, so edges crawl.
- [x] **World map** — engraved antique chart drawn in code: aged paper with foxing, graticule,
      simplified continent outlines (`worldShapes.ts`), compass rose, cartouche, border rules.
      Visited countries get brass pins, future destinations dark ones, placed from a country
      centroid table. Brass picture light above it.
- [x] **Photo frame** — a single horizontal carved-gilt frame showing the featured photo from
      `GET /photos/featured`; clicking opens the gallery. The ornament (layered mouldings,
      bead course, acanthus corners, edge cartouches) is drawn by `createGiltFrameTexture`
      with a transparent centre, so the picture shows through one plane. Replaced an earlier
      six-frame wall that was cluttered and crowded the clock.
- [x] **Privacy key** on a brass hook, swaying gently and lifting when you reach for it.
- [ ] Mailbox (deferred by owner)

**Room layout (check before adding anything).** Rearranged to the owner's mockup, 2026-09-07.

Back wall (z ≈ −3.36), left → right:

| x | object | span |
|---|---|---|
| −3.15 | light switch | tiny |
| −2.10 | bookshelf (1.52 × 2.32, 4 shelves) | −2.86 … −1.34 |
| −1.32 | plant (stands forward at z −2.98, scale 0.68) | −1.52 … −1.12 |
| −0.20 | world map | −1.01 … 0.61 |
| 1.55 | photo frame, over the couch | 0.94 … 2.16 |
| 2.72 | privacy key | tiny |
| 3.05 | longcase clock, angled −0.42 rad into the corner | 2.78 … 3.32 |

Floor: couch at 1.55 (1.78 wide, spans 0.66 … 2.44 — it must stop short of the clock base at
2.78), plant by the window at (−2.95, 2.1) **well clear of the glass**. Window wall: window
z 0.15, mirror z −2.1.

**Camera (owner-approved framing): (2.0, 1.62, 2.5) → (−0.5, 1.45, −2.9), fov 54.** Do not
drift from this without asking. Two failure modes already found:
- *Too far back / too wide* (1.25, 1.68, 3.0 at fov 60) — a sea of empty floorboards.
- *Too close* (0.85, 1.58, 1.85 at fov 55) — the window falls out of frame entirely.

Floor visibility is driven by **pitch, not distance**: keep the target height near the camera
height so the view stays roughly horizontal.

**Deliberate hierarchy:** the bookshelf is the largest object in the room because it is the
one that actually does something. Furniture must never out-weigh it — a cream couch did
exactly that and had to be recoloured.

**Colour lessons from review (2026-09-07):**
- *Gilt is metal, not yellow.* A bright yellow frame with a strong emissive glow reads as
  plastic. Antique gold at high metalness with a *low* emissive is what looks like gilding.
- *The couch needs to be the one thing that isn't wood.* Cream was too loud, plain brown
  vanished into the joinery; deep bottle-green velvet is period-correct and gives the room its
  only non-timber colour.
- *Dark timber in quantity reads as crude joinery.* The bookshelf moved to honeyed walnut,
  with a quieter flatter figure on the back panel so it recedes behind the books, plus a
  two-step moulded cornice, a plinth and a gilt bead.
- Sunset was pulled from saturated orange to warm amber — the orange flattened every surface
  in the room to one tangerine note.

**Layered light (owner reference, 2026-09-07).** What makes the reference rooms feel alive is
warm light at *several heights*, not one bright ceiling fixture. Added:
- **Concealed strip lighting under every bookshelf shelf**, washing down over the spines, with
  one unshadowed point light per shelf.
- **A lit planter recess** in the wall under the world map (map raised to 1.99 to clear it) —
  dark reveal, cream jambs, a concealed strip along the head, small low foliage. Built as a
  shallow proud box, not a real hole: cutting the wall would mean rebuilding it in pieces like
  the window opening. Keeping it **on the wall rather than on the floor** is also what stops
  the couch feeling jammed up against it.
- Plant pots moved from terracotta to **cream glazed ceramic** — terracotta was one more brown
  in an already brown room.

**Plants.** Leaves are a pointed bézier silhouette (`LEAF_GEOMETRY`), not scaled spheres —
ellipsoids give every leaf a rounded bulbous tip, which is most of why the first version read
as a toy. Arranged in three loose tiers so each plant has an inner crown and outer skirt.

Point lights are budgeted deliberately: one per shelf, two in the niche. Every extra
one costs fragment-shader work in *every* material, and the scene already carries the pendant,
window and picture light.

**Never add or remove a light at runtime — only change its intensity.** Three.js bakes the
scene's light counts into every material's compiled shader, so mounting or unmounting a light
invalidates and recompiles all of them. That recompile was the whole-app freeze on flicking the
light switch. The lamp's fill ambient is now permanently mounted at intensity 0 when off, and
the pendant no longer toggles `castShadow` (a point-light shadow also costs six cube-face
renders per frame, so it is off entirely — the sun carries the room's shadows).

**Time of day.** Sunset now ends at 19:00, not 20:00, so a quarter past seven already reads as
evening. Night stays deliberately *legible* with the lamp off; flicking the switch adds a warm
ambient fill on top of the pendant, so the switch visibly transforms the room.

**Sill-through-curtain bug (2026-09-07):** cream dashes appeared across the closed curtains at
the fold frequency. The fold corrugation displaces the cloth ±4 cm in depth and the sill's
front face reached z 0.21, so every fold trough dipped behind the sill. Curtains moved out to
z 0.34. Tiebacks removed at the owner's request; open curtains are now squeezed to 60% rather
than 38%, and fold deeper when gathered, so they read as heavy cloth.

**Back wall layout.** Objects are spaced left to right with clear gaps, since two of them were
colliding: mirror −2.85, clock −1.75, map −0.1, bookshelf 1.95, light switch 2.75. Check these
spans before adding anything else to that wall.

**Three bugs fixed (2026-09-07):**
- *Curtain gaps.* Seven separate strips opened holes the moment they were pinched, and the
  sheer behind showed through as a pale band. Each side is now **one continuous panel** whose
  folds are depth corrugations in the mesh, so it cannot open a gap. The sheer is also sized
  exactly to the glass — it used to be taller than the opening, showing its hem below.
- *Invisible mirror.* It was on the right-hand wall, which the default camera never looks at.
- *Map behind the bookshelf.* They overlapped between x 0.96–1.10.

**Curtain drag bug (2026-09-07):** dragging silently did nothing. `onPointerMove` on a mesh
only fires while the pointer is over that mesh, and a curtain pleat is a few centimetres wide,
so the pointer left it within the first frames of movement. Now tracked with window-level
pointermove/pointerup listeners started on pointerdown. A plain click also toggles fully
open/closed, since that is the obvious gesture.

**Bug found and fixed (2026-09-07):** the books rendered as blank cream slabs. An old "pages"
mesh was still being drawn 1 mm *in front of* the spine, covering the gilt entirely. The
ornament had been rendering correctly the whole time. Page edges now come from the box's own
head/tail/fore-edge faces via the per-face material array.

### Phase 5 — The interface layer (owner-specified, 2026-09-07)

### Privacy model — FINAL. This overrides earlier per-field work.

| Thing | Granularity |
|---|---|
| Featured photo | **Public.** Behaves like a profile picture; always visible to a visitor. |
| Gallery photos | Per photo |
| Books | Per book |
| Timeline events | Per event; the shared timeline **closes the gaps** — hidden events leave no space |
| World map | **Whole object.** Private means a visitor's click does nothing at all |
| Identity (mirror) | **Whole object.** One seal on the document, not a switch per line |

One share link exposes everything marked Shared. There is no per-item link.

`PROFILE` and `MAP` are whole-object switches whose `entityId` is the **user's own id**.
The privacy key object has been **removed from the room** — privacy is set on each item where
you edit it, so a separate key had no job.

**Bug this fixed:** the identity toggle wrote a `PrivacySetting` row while the shared view read
per-field columns, so it silently did nothing and always displayed "Private" regardless of
state. `GET /profile` now returns its own `visibility`.

### Interface direction — content opens *in* the room

The room is never unmounted. Clicking an object moves the camera, then the content arrives as
a document over the still-live room, which is dimmed and defocused behind it.

- **Text stays in the DOM.** WebGL text is blurry at angles, unselectable and inaccessible,
  and typing into a perspective-mapped form is miserable. Rejected `<Html transform>` for
  anything editable.
- **The design system lives in `index.css`** as `@layer components`: `.paper`, `.display`,
  `.small-caps`, `.ruled-field`, `.brass-button`, `.hairline`.
- **The key rule: a field on paper is a ruled line with its label above it, never a bordered
  box.** That single change does more for the aesthetic than any texture.
- Fonts are **system stacks** (Georgia + Segoe UI). The room ships no downloaded assets and
  the layer on top of it shouldn't either.
- Owner has **dropped** the spec's "no decorative interactions" line: an animated page turn
  for the library is wanted.

**Paper is layered, never a flat fill.** `.paper` composes foxing blotches, a tonal drift, a
vignette and *two* SVG `feTurbulence` noise passes as data URIs — fine fibre plus coarse
directional laid lines. A single background colour is what made the first attempt read as a
div. No image files, same rule as the room.

**Typeface — open decision.** The owner asked for Caslon Antique. A true Caslon needs either a
Google Fonts request or a shipped font file, both of which break the no-downloaded-assets rule
the room follows. Current stack is genuine old-style faces already on the machine: Garamond →
Book Antiqua → Palatino → Baskerville. If the owner accepts one webfont request, swap in
Cormorant Garamond or EB Garamond (the stack already names them first, so it is a one-line
change).

**Typing must never stutter — three causes, all found in one pass (2026-09-07):**
1. The room kept rendering at 60fps behind an open document. `frameloop="never"` while a panel
   is open; the scene is frozen, not unmounted.
2. `backdrop-blur` on the overlay re-blurred the entire live canvas on every repaint, and every
   keystroke is a repaint. Replaced with a plain wash.
3. `mix-blend-mode: multiply` on the paper's noise layers forced the whole sheet through a
   compositing step per repaint. Plain opacity instead.

Anything added over the room should be checked against these three.

**Paper grain comes from noise, never from shapes.** Hard-edged radial gradients read as
literal dots on the page — worse than a flat fill.

**One typeface throughout.** Headings, body and inputs are all the old-style serif; a sans
input under a serif heading is what made the forms feel bolted on. Fields change only their
rule colour on focus — tinting the background made the paper appear to change colour as you
typed.

**Privacy changes are confirmed, never instant.** The confirmation renders *inline*, not as a
floating popover: the panel clips its own overflow for its rounded corners and swallowed the
popover completely. Toggling opens a small note explaining what
the visitor will or will not gain access to, and asks. Exposure shouldn't be one careless click.

Panels built so far: **Identity + Notebook** (`IdentityPanel`). The notebook belongs to the
mirror alongside identity and the gallery (spec C.1) — it was missing. Still to convert: library (book spread
with page turn), timeline (scroll), gallery (prints), places/map, and the auth screens.

### Still not wired to any UI

- **Files** — full backend, no client, no UI.
- **Mailbox** — full backend, no client, no UI. Owner will specify the design later.
- ~~Notes privacy~~ — **decided: the notebook is always private.** `NOTE` has been removed
  from the privacy entity types and notes are no longer returned by the shared view. It is the
  one place in LIFE meant for things you are not showing anyone, so it has no share control at
  all rather than one that merely defaults to off.
- **Map has no page yet** — the room object currently opens `/dashboard`.

## Still open

- [ ] **Look at it again and judge** — the honest re-test
- [ ] Stage 3: more shelf life (leaning books, a gap where one was pulled out)
- [ ] Stage 4: longcase clock (replacing the wall clock), mirror, world map, photo frame,
      privacy key, mailbox
- [ ] Stage 5: **the interaction layer** — clicking must open content *in the room* as paper
      or an open book, never a route change to a white form. Then the same vintage design
      language applied back to every plain page and the login/signup screens.
- [ ] Stage 6: atmosphere — dust in the sunbeam, swaying key, pendulum, idle motion

Texture generation is cached per parameter set (`textures.ts`), and all books share one cloth
map tinted per book. Without that, a shelf of twelve books built twelve identical textures on
the main thread and froze the page.

Bundle: plain UI 102 KB gzipped, room chunk 260 KB, loaded only on `/room`.

## Room objects → backend features

| Object | Backed by | Ready? |
|---|---|---|
| Mirror | Profile + Notes + Gallery | yes |
| Bookshelf | Books / Chapters / Items | yes |
| Clock | Timeline + goals | yes |
| Photo frame | `GET /photos/featured` | yes |
| World map | VisitedCountry | yes |
| Privacy key | PrivacySetting | yes |
| Mailbox | Letters between accounts | yes |
| Window | Local device time only, no data | n/a |

**No desk** — the notebook lives behind the mirror.

## Phase 5 — Full room ⬜ not started

## Phase 6 — Deployment migration ⬜ not started

Swap `StorageService` → Supabase Storage, `MailService` → a real email provider,
optionally `AuthService` → Supabase Auth. Deploy to Vercel + Render.

## Phase 7 — Polish ⬜ not started

---

## Decisions made along the way

| Decision | Reason |
|---|---|
| Tailwind, not CSS Modules | One styling system; fast for the plain CRUD phases, fine alongside SVG later |
| Prisma pinned to 6.x | Prisma 7 requires driver adapters; 6 keeps the conventional, well-documented setup |
| Postgres on host port **5433** | Port 5432 is taken by a native Postgres install on this machine |
| Email verification added in Phase 0 | Requested; real token flow is worth having and Mailpit makes it free |
| Unauthorized access returns 404, not 403 | Does not leak whether a record exists |
| Re-signup replaces an *unverified* account | An unverified registration is not yet owned by anyone |
