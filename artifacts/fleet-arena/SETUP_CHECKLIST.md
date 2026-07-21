# Fleet Arena — Setup Checklist

Follow top to bottom to go from a fresh clone to a running app. Paths are
relative to `artifacts/fleet-arena/` unless noted.

## Prerequisites
- [ ] Node 20+ and `pnpm` installed.
- [ ] Supabase CLI installed (for backend work).
- [ ] Expo Go app on a physical device (for QR testing), or a dev build.

## Install & env
- [ ] From the **workspace root**: `pnpm install`.
- [ ] `cp .env.example .env` and fill in values (see `.env.example`).
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
      (required — `lib/supabase.ts` throws without them). On Replit these come
      from workspace Secrets / `userenv`.
- [ ] Confirm the service_role key is **not** in any `EXPO_PUBLIC_*` var.

## Supabase backend
- [ ] Read [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).
- [ ] Link the project: `supabase link` (or use local `supabase db reset`).
- [ ] Apply schema: `supabase db push` (migrations in `supabase/migrations/`).
- [ ] Deploy functions: `bash supabase/functions/scripts/sync-engine.sh` then
      `supabase functions deploy --use-api`.
- [ ] (dev/preview only) Seed demo data: `psql "$DATABASE_URL" -f supabase/seed.sql`.
      **Do NOT seed production.**

## Run
- [ ] Start Expo: `pnpm --filter @workspace/fleet-arena run dev`.
- [ ] Web preview loads at the Replit **Fleet Arena** artifact (`/`).
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
