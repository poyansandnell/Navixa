# Navixa — Setup Checklist

Follow top to bottom to go from a fresh clone to a running app. Paths are
relative to `artifacts/navixa/` unless noted.

## Prerequisites
- [ ] Node 20+ and `pnpm` installed.
- [ ] Expo Go app on a physical device (for QR testing), or a dev build.

## Install & env
- [ ] From the **workspace root**: `pnpm install`.
- [ ] `cp .env.example .env` and fill in values (see `.env.example`).
- [ ] Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_DOMAIN`
      (required). On Replit these come from workspace Secrets / `userenv`.
- [ ] Confirm `CLERK_SECRET_KEY` / `DATABASE_URL` are **not** in any
      `EXPO_PUBLIC_*` var (server-side only).

## Backend (Replit-native)
- [ ] Replit PostgreSQL is provisioned; `DATABASE_URL` is auto-supplied.
- [ ] Push the Drizzle schema (dev): `cd lib/db && pnpm run push`.
- [ ] api-server (`artifacts/api-server`) runs and serves `/api`
      (Socket.IO at `/api/socket.io`); reads `DATABASE_URL` + Clerk keys.
- [ ] (dev/preview only) Demo data is seeded on boot (`seedDatabase()`, idempotent).
      **Do NOT seed production** (prod schema is applied automatically on Publish).

## Run
- [ ] Start Expo: `pnpm --filter @workspace/navixa run dev`.
- [ ] Web preview loads at the Replit **Navixa** artifact (`/`).
- [ ] On device: open Expo Go, scan the QR code.

## Verify quality gates
- [ ] `pnpm run typecheck` → clean.
- [ ] `pnpm run lint` → clean.
- [ ] `pnpm run test` → vitest engine suite passes.

## Smoke test the app
- [ ] Onboarding + sign-up (email/password) works.
- [ ] Offline bot match (`app/game`) plays to a result.
- [ ] Online search / private match (needs a second account or seeded data).
- [ ] Friends, leaderboard, profile, history + replay render.
- [ ] Settings, shop (test currency), tournaments, legal pages render.
- [ ] Language switch (14 locales) applies immediately.

## Known constraints
See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md): IAP, social OAuth, push, and
`app.json` (no `app.config.ts`).
