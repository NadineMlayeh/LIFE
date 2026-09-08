# LIFE — Remaining build plan

Agreed with the owner on 2026-09-08. This is the forward plan; `PROGRESS.md` is the record of
what is already built and why. Read both.

The room itself is finished. What remains is the **interface layer** (documents that open
inside the room) and then the **social layer** (the world outside the window).

---

## Decisions taken (do not re-litigate)

| Question | Decision |
|---|---|
| Which books stand on the shelf when it is full | **Manual pick.** The owner chooses; the rest live in the full library |
| Who may visit a room | **Anyone.** A visitor sees exactly what a share-link holder sees |
| Files module | **Removed entirely.** Gallery photos cover the need; delete the backend module, its routes and the `File` model |
| Usernames | **Permanent**, chosen at signup. The only public handle |
| The outside scene | **Start small** — porch/garden gate with the mailbox, street only suggested. Expand only if it earns it |
| Notebook privacy | Always private, no control (already done) |

### Two positions worth holding

**Email must never be the way people find each other.** That is the entire reason for adding
usernames: it lets someone be findable without exposing their email address. Email becomes
login-only.

**A share link and a visit should be the same thing.** The shared-view API already returns
exactly the right filtered data, so "visiting" is just rendering the room from someone else's
shared payload. Stage 6 retires the plain shared page rather than maintaining two views of the
same concept.

---

## Stages, in order

Each stage ships something usable on its own. Do not start a stage before the previous one is
accepted.

### Stage 0 — Remove the files concept
Delete the `files` module, its DTOs, controller, service and routes; drop `File` from the
Prisma schema plus the `files` relations on `User`, `TimelineEvent` and `Item`; migrate.

### Stage 1 — Timeline panel *(flagship)*
A vertical *échelle de temps*, not a form. Evenly spaced rungs regardless of real elapsed time;
the true gap revealed on the connector between two events; past solid, present emphasised,
future outlined; goals with their "did you accomplish this?" resolution; search and date-jump.
Layered depth and real motion — explicitly **not** the identity form's level of ambition.

### Stage 2 — Library
- Book opens as a **spread with an animated page turn** (the owner has explicitly dropped the
  spec's "no decorative interactions" line for this).
- **Shelf capacity:** when the shelf is full, the owner manually picks which books stand on it.
  Needs a schema field on `Book` (e.g. `onShelf`) plus a picker in the library panel.
- Chapters and entries edited within the spread.

### Stage 3 — Gallery
A photo album you leaf through. Per-photo visibility. Pick the thumbnail that hangs in the
room's wall frame (`isFeatured` already exists backend-side).

### Stage 4 — Map
Full world country list to choose from; chosen countries appear as pins on the chart. Whole-map
privacy. Needs a country dataset — name, ISO code and centroid — extending the ~60 entries
already in `worldShapes.ts` to the full set.

### Stage 5 — Auth screens
Login, signup, verification and the "check your email" screen in the paper language. These are
the first thing anyone ever sees and are still default forms. Signup also gains the username
field here.

### Stage 6 — Visiting
Share links open a **room**, not a page: the visitor sees the host's room rendered from the
shared payload, with only shared objects interactive. Retires `SharedViewPage`.

### Stage 7 — Outside and the mailbox
- `username` on `User`: unique, required, permanent. Migration for existing accounts.
- **Opt-in listing.** Findable by exact username always; appears in the browsable list only if
  the user opts in. Default unlisted.
- Clicking the window goes outside: porch, garden, mailbox, street suggested beyond.
- Mailbox: write a letter, read letters, find people, visit them. Backend for letters is
  already complete (`/mailbox`).
- Return home.

---

## How to spend the effort

**Build every stage to "good", then do one polish pass across all of them.**

The room reached its quality through roughly fifteen rounds of critique, and the expensive part
was never the building — it was the review loop. Polishing each panel to that standard *in
isolation* would multiply the total, and worse, you cannot judge whether the timeline and the
gallery feel like the same product until both exist. One pass at the end, seeing it whole, is
both cheaper and better.

"Perfect" is the word that decides the schedule. Ship coherent first.
