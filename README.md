# LIFE

A private, interactive web app representing a person's whole life — identity, memories,
life categories ("books"), a timeline of past events and future goals, photos, and a
map — as one connected world.

Full product spec: see `LIFE_master_spec.md`.

## Status

**Phase 0 — Skeleton** (in progress): auth + empty authenticated dashboard, no room graphics yet.

## Stack

- Frontend: Vite + React + TypeScript + Tailwind CSS + React Router
- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Auth (dev): email/password, bcrypt + JWT, local only — swapped to Supabase Auth at deploy time
- Storage (dev): local disk — swapped to Supabase Storage at deploy time
- Local DB: PostgreSQL via Docker Compose

## Running locally

Prerequisites: Docker Desktop must be running before step 1.

Open three terminals in the project root (`Desktop/LIFE`).

### 1. Start the database

```
docker compose up -d
```

This starts two containers:

- **Postgres** on port **5433** (not the usual 5432, which is taken by a
  PostgreSQL server already installed on this machine)
- **Mailpit**, a local mail catcher — the app's emails do not leave your machine.
  Read them at **http://localhost:8025**

### 2. Backend — terminal 2

```
cd backend
npm run start:dev
```

Runs on http://localhost:3000

First time on a new machine only: `cp .env.example .env` then `npx prisma migrate dev`.

### 3. Frontend — terminal 3

```
cd frontend
npm run dev
```

Open http://localhost:5173

## Signing up

Signup requires email verification. After submitting the form, open the
Mailpit inbox at **http://localhost:8025**, open the "Verify your LIFE account"
message, and click the link. Only then can you log in.

Emails are sent over SMTP to Mailpit in development. At deployment (Phase 6),
only `MailService` changes — swap the transport for a real provider.

## Stopping

- Frontend / backend: `Ctrl+C` in their terminals
- Database: `docker compose stop` (keeps data) — `docker compose down -v` deletes all data

## Useful commands

```
cd backend && npx prisma studio      # browse the database in a GUI
cd backend && npx prisma migrate dev # apply schema changes after editing prisma/schema.prisma
```
