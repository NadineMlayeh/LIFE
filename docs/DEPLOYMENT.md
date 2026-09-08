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
| Photographs | **Cloudflare R2** | 10 GB free, and **no charge for reading files back**, which is unusual and matters for an image-heavy app. |
| Email | **Resend** | 3,000 emails a month free, permanently. |

### Why Neon and not Supabase

This is the decision worth understanding, because it is the difference between a link that
works and a link that embarrasses you.

**Supabase's free tier pauses the entire project after a week of inactivity**, and it needs a
manual click in the dashboard to come back. For an app you show people occasionally — a link in
a CV, a post someone reads a month later — that means it is *broken every time it matters*.

**Neon does not pause the project.** It scales the compute to zero when idle and brings it back
on the next query, typically in under half a second. The first visitor after a quiet week waits
an extra moment. Nobody has to unpause anything.

Both are excellent; they simply optimise for different things. For a portfolio piece that sits
untouched between viewings, Neon's behaviour is the one you want.

### Why the API is a function, not a server

Free hosting for an always-on server has largely disappeared. Render's free tier sleeps after
15 minutes and takes the better part of a minute to wake — a visitor is likely to close the tab
first.

A serverless function inverts it: there is no process between requests at all. The host wakes a
copy when a request arrives, and cold starts are on the order of a second rather than a minute.
That is why it can be free, and it is why two things in this codebase are the way they are:

- **Photographs go to object storage, never disk.** A serverless machine has no persistent
  filesystem — a file written during one request is gone before the next. Local disk in
  production loses every upload *silently*, which is the worst kind of failure.
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

## 2. Photograph storage — Cloudflare R2

1. Sign up at **cloudflare.com**, open **R2** in the sidebar, and create a bucket. Call it
   `life-photos`.
2. **Manage R2 API Tokens** → **Create API token**. Give it *Object Read & Write* on that
   bucket. Copy the **Access Key ID** and **Secret Access Key** — the secret is shown once.
3. Note the **S3 API endpoint** on the bucket page. It looks like
   `https://<account-id>.r2.cloudflarestorage.com`.

Keep the bucket **private**. LIFE streams photographs through the API on purpose, so every read
is checked against current privacy settings. A public bucket URL is a permanent key: anyone who
ever saw it keeps access forever, whatever you later decide.

---

## 3. Email — Resend

1. Sign up at **resend.com**.
2. Without a domain you can send from `onboarding@resend.dev`, but **only to your own address**.
   That is enough to prove it works. To send to anyone, add a domain under **Domains** and
   follow the DNS records.
3. **API Keys** → create one. Copy it.

SMTP settings: host `smtp.resend.com`, port `587`, user `resend`, password = the API key.

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
   | `SMTP_HOST` | `smtp.resend.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | `resend` |
   | `SMTP_PASS` | Your Resend API key |
   | `MAIL_FROM` | `LIFE <onboarding@resend.dev>` |
   | `S3_BUCKET` | `life-photos` |
   | `S3_ENDPOINT` | Your R2 endpoint |
   | `S3_REGION` | `auto` |
   | `S3_ACCESS_KEY_ID` | From R2 |
   | `S3_SECRET_ACCESS_KEY` | From R2 |

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
2. Register. **Check your inbox for a real email** — that proves Resend, `APP_URL` and the
   database are all correct at once.
3. Verify, log in, and open the room.
4. Upload a photograph and reload. If it survives, R2 is wired correctly. *This is the one to
   test properly*: with storage misconfigured the upload appears to succeed and the image is
   gone afterwards.
5. Cut a share link and open it in a private window.

---

## If something goes wrong

**Every request fails with a CORS error.** `FRONTEND_URL` on the API does not exactly match the
frontend's origin. No trailing slash.

**Emails never arrive.** Without a verified domain Resend only delivers to your own address.
Check Resend's dashboard — it logs every attempt and why it failed.

**Photographs vanish after upload.** `S3_BUCKET` is unset, so the API fell back to local disk
and the file went to a machine that no longer exists. The API's startup log says which backend
it chose.

**The first request after a quiet day is slow.** Expected: Neon waking and a cold function
start. Subsequent requests are normal.

**The build fails on `prisma migrate deploy`.** Usually the unpooled connection string.
Migrations want a direct connection; if it persists, set `DIRECT_URL` to the unpooled string
and add `directUrl = env("DIRECT_URL")` to the datasource block in `schema.prisma`.

---

## Costs

Nothing, at this scale. The limits you would hit first, in order:

1. **R2 storage** — 10 GB. Uploads are compressed in the browser to roughly 300 KB, so that is
   in the region of 30,000 photographs.
2. **Resend** — 3,000 emails a month. Only sent on signup and password reset.
3. **Neon** — 0.5 GB of database. Text is small; this is a long way off.
4. **Vercel** — 100 GB of bandwidth a month.

Photographs are the only thing that grows meaningfully, and browser-side compression is what
keeps that slow.
