# Deploying LIFE

Everything here is on a permanently free tier. Not a trial, not credits that run out — the
free plans these services actually intend people to stay on.

---

## The stack, and why each piece

| Piece | Service | Why this one |
|---|---|---|
| Frontend | **Vercel** | Free forever for personal projects. Static files on a CDN — nothing to keep running. |
| API | **Vercel Functions** | Same project type. No server sitting idle, so nothing to pay for and nothing to spin down. |
| Database | **Neon** | Free Postgres. See below — this is the choice that matters most. |
| Photographs | **The database**, or Cloudflare R2 | See step 2 — R2 is better, but asks for a card. |
| Email | **Any SMTP provider** | Four environment variables, no code. See step 3 for free ones that will write to strangers. |

### Why Neon and not Supabase

This is the decision that matters most, because it determines whether the deployed link works
when someone finally clicks it.

**Supabase's free tier pauses the entire project after a week of inactivity**, and it needs a
manual click in the dashboard to come back. For an app you show people occasionally — a link in
a CV, a post someone reads a month later — that means it is *broken every time it matters*.

**Neon does not pause the project.** It scales the compute to zero when idle and brings it back
on the next query, typically in under half a second. The first visitor after a quiet week waits
an extra moment. Nobody has to unpause anything.

Both are excellent; they simply optimise for different things. For an application that sits
untouched between visits, Neon's behaviour is the one that suits.

### Why the API is a function, not a server

Free hosting for an always-on server has largely disappeared. Render's free tier sleeps after
15 minutes and takes the better part of a minute to wake — a visitor is likely to close the tab
first.

A serverless function inverts it: there is no process between requests at all. The host wakes a
copy when a request arrives, and cold starts are on the order of a second rather than a minute.
That is why it can be free, and it is why two things in this codebase are the way they are:

- **Photographs never go to disk.** A serverless machine has no persistent filesystem — a file
  written during one request is gone before the next. They go to object storage or, failing
  that, the database. Local disk in production loses every upload *silently*, which is the
  worst kind of failure.
- **Rate-limit counters are per-instance.** They live in memory, so they reset when an instance
  is recycled. Documented in `common/rate-limit.guard.ts`; Redis is the fix if it ever matters.

---

## Before you start

Push the repository to GitHub. Vercel deploys from it and redeploys on every push.

---

## 1. The database — Neon

1. Sign up at **neon.tech** and create a project. Any region near you.
2. On the dashboard, copy the connection string. **Take the pooled one** — the host contains
   `-pooler`. There is a toggle for it.

   This matters: every serverless instance opens its own connection, and an unpooled Postgres
   runs out of them under even light traffic. The pooler exists exactly for this.
3. Keep it for step 4. It looks like:
   `postgresql://user:pass@ep-something-pooler.region.aws.neon.tech/neondb?sslmode=require`

Migrations run automatically on deploy — the API's build command includes `prisma migrate
deploy`, so the schema is created on the first deployment and updated on every one after.

---

## 2. Photograph storage

Two ways. **Pick B if you would rather not hand over a card** — it needs no second account at
all, and switching later is a change of environment variables, not of code.

### Option A — Cloudflare R2 (better, needs a payment card)

The right home for files: 10 GB free, and unusually, **no charge for reading them back**, which
matters for an image-heavy app. Cloudflare asks for a card to verify the account even on the
free plan; it is not charged at this scale.

1. Sign up at **cloudflare.com**, open **R2**, create a bucket called `life-photos`.
2. **Manage R2 API Tokens** → **Create API token**, *Object Read & Write* on that bucket. Copy
   the **Access Key ID** and **Secret Access Key** — the secret is shown once.
3. Note the **S3 API endpoint**: `https://<account-id>.r2.cloudflarestorage.com`.

Keep the bucket **private**. LIFE streams photographs through the API on purpose, so every read
is checked against current privacy settings. A public bucket URL is a permanent key: anyone who
ever saw it keeps access forever, whatever you later decide.

### Option B — store them in the database (no card, no extra account)

**Nothing to set.** With no bucket configured, a host that has no writable filesystem stores
photographs in the database automatically. `STORE_FILES_IN_DB=true` exists to force the same
behaviour locally, where the disk *is* writable.

Files in a database are not the ideal arrangement: backups grow larger and reads are heavier
than they would be against a bucket. At this scale it is nonetheless entirely workable, and a
deployment that exists beats a purer architecture that cannot be reached. Photographs are
compressed in the browser to roughly 300 KB, so Neon's free 0.5 GB holds **about 1,500 of
them**.

Adding a bucket later means setting the `S3_*` variables and turning this off. Existing
photographs would have to be copied across, but no application code changes — the storage layer
has a single seam, and which side of it is in use is decided entirely by configuration.

---

## 3. Email

The application speaks plain SMTP and **names no provider anywhere in its code**. Which service
carries the mail is four environment variables, so this is a decision you can change later for
free.

### The one thing to get right

Anyone can send mail to *themselves* on a free tier. The question that actually matters is
whether a provider will deliver to **someone else** — a recruiter registering an account —
without owning a domain first.

Providers verify a sender in one of two ways, and the difference decides everything:

- **Domain verification** — prove you own `yourname.com` via DNS records. The domain costs
  money. Resend and Postmark work this way; until you do it they will only write to the address
  the account was opened with, and every other recipient is refused.
- **Single-sender verification** — prove you control one *email address* by clicking a link
  sent to it. Free, instant, no domain. This is what you want.

### Gmail SMTP — recommended

No new account, no card, no domain, and 500 recipients a day.

It is also the only free option with no deliverability catch. Sending mail that claims to come
from a Gmail address is normally treated as forgery by every receiving server — but here it is
Google itself doing the sending, so it passes its own checks. Any other relay claiming a
`@gmail.com` sender is what lands in spam.

1. The account needs **2-Step Verification** on: Google Account → **Security**.
2. Then open **App passwords** (search for it in Google Account settings). Create one, named
   anything. Google shows a **16-character password once** — copy it. It is not your Gmail
   password, and it can be revoked on its own without touching the account.
3. Settings: host `smtp.gmail.com`, port `587`, user = the full Gmail address, password = the
   16-character app password.

Use a separate Gmail if you would rather your personal address not appear as the sender.
`MAIL_FROM` must be **that same address** — Gmail rewrites anything else, so a mismatch is
silently ignored rather than honoured.

### Brevo — if you would rather not use a Gmail account

Free permanently, 300 emails a day, no card. Sign up at **brevo.com**, add your address under
**Senders** and click the link it emails you, then take the SMTP key from **SMTP & API**.

Settings: host `smtp-relay.brevo.com`, port `587`, user = your Brevo login email, password =
the SMTP key.

The sender should ideally not be an `@gmail.com` address here — Brevo is not Google, so mail
claiming to come from Gmail is treated with suspicion by receiving servers. Fine for a demo,
worth knowing.

### Resend — only once you own a domain

3,000 emails a month, and the nicest of the three to work with, but domain-verified only:
`onboarding@resend.dev` reaches **the address the Resend account was opened with and nobody
else**. Good enough to prove the plumbing works; not good enough for a site strangers sign up
to. If you buy a domain later, this is the one to move to.

Host `smtp.resend.com`, port `587`, user `resend`, password = the API key.

---

## 4. The API — Vercel

1. At **vercel.com**, **Add New → Project**, import the repository.
2. Set **Root Directory** to `backend`.
3. Add these environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon's **pooled** string |
   | `JWT_SECRET` | A long random string — run `openssl rand -base64 48` |
   | `JWT_EXPIRES_IN` | `7d` |
   | `APP_URL` | Your frontend URL (fill in after step 5, then redeploy) |
   | `FRONTEND_URL` | The same |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Your full Gmail address |
   | `SMTP_PASS` | The 16-character app password |
   | `MAIL_FROM` | `LIFE <the-same-gmail-address>` |

   Then **either** (option A):

   | Name | Value |
   |---|---|
   | `S3_BUCKET` | `life-photos` |
   | `S3_ENDPOINT` | Your R2 endpoint |
   | `S3_REGION` | `auto` |
   | `S3_ACCESS_KEY_ID` | From R2 |
   | `S3_SECRET_ACCESS_KEY` | From R2 |

   **or** (option B — no card):

   | Name | Value |
   |---|---|
   | `STORE_FILES_IN_DB` | `true` |

4. Deploy. Note the URL — something like `life-api.vercel.app`.

**`JWT_SECRET` is the one that must be secret.** It is what proves a login token is genuine;
anyone holding it can forge a session for any account. Never commit it, and never reuse the
local one.

---

## 5. The frontend — Vercel

1. **Add New → Project**, import the *same* repository again.
2. Set **Root Directory** to `frontend`.
3. Add one variable: `VITE_API_URL` = the API URL from step 4.

   This is baked in at **build** time, not read at runtime — Vite substitutes it into the
   bundle. Changing it later needs a redeploy, not just a restart.
4. Deploy.

---

## 6. Close the loop

Go back to the **API** project's settings and set `APP_URL` and `FRONTEND_URL` to the frontend's
real URL, then redeploy it.

Both matter:

- `APP_URL` builds the links inside verification and password-reset emails. Wrong, and every
  link in every email points at localhost.
- `FRONTEND_URL` is the **CORS allow-list**. The API refuses browser requests from any other
  origin, so if this is wrong the site loads and then every request fails.

---

## Checking it worked

1. Open the frontend. The auth doors should appear.
2. Register with an address that is **not** the sending account's own — a second address of
   yours, or a friend's. Delivering to yourself proves almost nothing; delivering to somebody
   else is the thing that has to work, and it proves the mail provider, `APP_URL` and the
   database are all correct at once.
3. Verify, log in, and open the room.
4. Upload a photograph and reload. If it survives, R2 is wired correctly. *This is the one to
   test properly*: with storage misconfigured the upload appears to succeed and the image is
   gone afterwards.
5. Cut a share link and open it in a private window.

---

## Who has actually used it

Two different questions, and they need two different answers.

**How many people looked?** Turn on **Web Analytics** in the Vercel project (Analytics tab, one
click, free on the Hobby plan). Visitors, page views and referrers — so a spike from a posted
link is visible as a spike.

**Who got as far as an account?** That is in the database. Neon's dashboard has a **SQL Editor**;
this is the whole report:

```sql
SELECT username,
       email,
       "createdAt"    AS registered,
       "emailVerified" AS verified,
       "lastLoginAt"  AS last_seen,
       "loginCount"   AS logins
FROM "User"
ORDER BY "createdAt" DESC;
```

The columns that matter are the last three. `verified = false` means the verification email
never got clicked — if that is *everybody*, the mail provider is refusing recipients rather
than people losing interest, and step 3 is the place to look. `logins = 0` on a verified
account means someone confirmed their address and never came back. A row with several logins
is a person who actually looked around.

Failed attempts are not counted: the record is written only after a login succeeds, so a
mistyped password never reads as a visit.

---

## If something goes wrong

**Every request fails with a CORS error.** `FRONTEND_URL` on the API does not exactly match the
frontend's origin. No trailing slash.

**Registering says the letter could not be sent, or it arrives for you and nobody else.** The
provider is refusing the recipient. Almost always this means a **domain-verified** provider is
in use without a domain — see step 3, and switch to a single-sender one, which is four
environment variables and a redeploy.

The account is still created either way: the server says so plainly rather than failing, and
the reason is written to the API's log in full (`Could not send the verification email: …`).
That log line is the fastest way to tell a refused recipient from a wrong password.

**Mail sends, but lands in spam.** Start with what `MAIL_FROM` claims. A `@gmail.com` sender is
only trustworthy when Gmail is the one sending — routed through any other provider it is
treated as forgery, because that is precisely what forgery looks like. Gmail's own SMTP is
therefore the free option least likely to be filtered.

A shared sandbox sender such as `onboarding@resend.dev` is the other common cause: thousands of
developers send from it, so it carries no reputation of its own and mailbox providers treat it
accordingly. Neither case is a misconfiguration exactly, and the full fix is the same one — a
verified domain, which publishes the SPF and DKIM records that prove the mail originates where
it claims.

Until then the interface says so plainly: the screen shown after signing up directs people to
their spam folder, as do the resend notice and the password-reset screen. A letter that appears
not to have arrived is worth a sentence rather than a silence.

**Photographs vanish after upload.** Neither `S3_BUCKET` nor `STORE_FILES_IN_DB` is set, so the
API fell back to local disk and the file went to a machine that no longer exists. The API's
startup log says which backend it chose — check it says "bucket" or "database", never "local
disk", in production.

**The first request after a quiet day is slow.** Expected: Neon waking and a cold function
start. Subsequent requests are normal.

**The build fails with `prisma: command not found` (exit 127).** The build must run as an npm
script, not as a bare shell command — npm puts `node_modules/.bin` on the PATH and a plain
shell does not. It is the `vercel-build` script in `backend/package.json`, which Vercel picks
up automatically.

**The build fails on `prisma migrate deploy`.** Usually the unpooled connection string.
Migrations want a direct connection; if it persists, set `DIRECT_URL` to the unpooled string
and add `directUrl = env("DIRECT_URL")` to the datasource block in `schema.prisma`.

**Every route 404s once deployed.** All paths are rewritten to `/api/<path>` so one catch-all
function serves the API, and the handler strips that prefix before Express sees the request —
Nest's routes are declared as `/auth/login`, not `/api/auth/login`. If you change the rewrite,
change the prefix stripping in `api/[[...path]].ts` to match.

**A TypeScript error on the host that does not happen locally.** Almost always CommonJS/ESM
interop: a package published as CommonJS with a single callable export compiles under one set
of interop settings and not another, and the host's may differ from yours. `helmet` failed this
way ("this expression is not callable") and was replaced with a few explicit headers in
`common/security-headers.ts` — most of what it does is for HTML pages, and this server serves
none.

**`npm warn allow-scripts` during install.** Vercel blocks package install scripts by default.
Two of ours wanted them: Prisma's, which does not matter because `vercel-build` runs
`prisma generate` explicitly, and `bcrypt`'s, which compiled a native binary. That is why the
project uses **`bcryptjs`** — pure JavaScript, no build step, and it produces and verifies the
same standard hashes, so nothing about existing passwords changes.

---

## Costs

Nothing, at this scale. The limits you would hit first, in order:

1. **Photograph storage** — 10 GB on R2 (around 30,000 photographs), or the database's 0.5 GB
   (around 1,500). Uploads are compressed in the browser to roughly 300 KB.
2. **Email** — 500 recipients a day through Gmail, 300 through Brevo, 3,000 a month on
   Resend. Only sent on signup and password reset, so this is a long way off.
3. **Neon** — 0.5 GB of database. Text is small; this is a long way off.
4. **Vercel** — 100 GB of bandwidth a month.

Photographs are the only thing that grows meaningfully, and browser-side compression is what
keeps that slow.
