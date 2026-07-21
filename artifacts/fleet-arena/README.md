# Fleet Arena

A global, multiplayer **Battleship** game built for the Expo showcase. Fleet
Arena is an Expo React Native app (iOS / Android / web) backed by Supabase
(Postgres + Row Level Security + Edge Functions). It ships offline bot matches,
online ranked/casual/private play, matchmaking, tournaments, quests,
achievements, a cosmetics shop (test currency only), friends/leaderboards, and
match replays — localized in 14 languages.

> **Platform note / spec deviation:** the original spec called for
> `app.config.ts`. On Replit the Expo Launch tooling requires a **static
> `app.json`**, so the project uses `app.json` instead. No `app.config.ts`
> exists by design — see [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

---

## Tech stack

| Layer | Tech |
|-------|------|
| App | Expo SDK 54, React Native 0.81, React 19, expo-router v6 (typed routes), New Architecture + React Compiler |
| State | Zustand (`store/`), TanStack Query, Zod validation |
| Game engine | Pure TypeScript in `lib/engine` (no RN imports) — placement, RNG, bots, Elo rating, match state, simulation; tested with Vitest |
| i18n | i18next + react-i18next + expo-localization; base locales in `i18n/locales`, extra strings merged from `i18n/partials` in `i18n/index.ts` |
| Backend | Supabase: Postgres 17 schema in `supabase/migrations`, 18 Deno Edge Functions in `supabase/functions`, RLS everywhere |
| Client SDK | `@supabase/supabase-js` via `lib/supabase.ts` (anon key only) |

## Project structure

```
artifacts/fleet-arena/
├─ app/                    expo-router routes
│  ├─ (auth)/              sign-in, sign-up, magic-link, forgot/complete-profile
│  ├─ (tabs)/              home, compete, friends, leaderboard, profile
│  ├─ game/                offline bot match (setup → play → result)
│  ├─ online/              online play (search, private, setup, play, result, join/[code])
│  ├─ tournaments/         tournament detail
│  ├─ shop/  settings/  legal/  history/  profile/  onboarding  devtools
├─ features/              domain logic: auth, game, matchmaking, onlineMatch,
│                          tournaments, quests, shop, social, history, notifications
├─ lib/                   supabase client, engine, settings, devtools
├─ store/                 zustand stores (game, settings)
├─ components/            ui + game components, error boundary
├─ hooks/                 useColors, useIsGuest, useOnboarding
├─ i18n/                  index.ts (merge), locales/, partials/
├─ assets/images/         icon.png
├─ supabase/
│  ├─ migrations/         Postgres schema (applied in timestamp order)
│  ├─ functions/          Edge Functions (Deno) + _shared/ + README.md
│  ├─ seed.sql            dev/preview demo data
│  └─ config.toml
├─ app.json  eas.json  .env.example
└─ README.md + checklists (SETUP/RELEASE/APP_STORE/GOOGLE_PLAY/SECURITY/…)
```

## Local setup

Prerequisites: Node 20+, `pnpm`, and (for backend work) the Supabase CLL.

```bash
# From the workspace root — installs the whole pnpm workspace
pnpm install

# Copy the example env and fill in your Supabase values (see below)
cp artifacts/fleet-arena/.env.example artifacts/fleet-arena/.env
```

### Environment variables

Only `EXPO_PUBLIC_*` variables reach the client bundle. The two required ones
are `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
(`lib/supabase.ts` throws at startup if they are missing). On Replit these are
provided through the workspace Secrets / `userenv`. See
[`.env.example`](./.env.example) for the full list (app env, public legal/support
URLs, optional Sentry DSN).

> The **service_role** key is server-side only and must never appear in a
> client env var. Supabase auto-injects it into the Edge Function runtime.

### Supabase setup

The full backend guide — schema, tables, security model and functions — lives in
[SUPABASE_SETUP.md](./SUPABASE_SETUP.md). Quick reference:

```bash
cd artifacts/fleet-arena

# Apply migrations to the linked hosted project (does NOT run seed.sql)
supabase db push

# — or — full local reset (Docker): recreates DB, runs migrations + seed.sql
supabase db reset
```

Migrations in `supabase/migrations/` are applied in filename (timestamp) order.
**Do not hand-edit or hand-apply migrations** — the CLI/platform manages order.

### Seeding demo data (dev / preview only)

`supabase/seed.sql` creates ~20 demo players, match history, friendships,
achievements, cosmetics, quests and tournaments so preview builds look alive.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

> **Never** run `seed.sql` against production — it inserts fake `auth.users`.

### Deploying Edge Functions

18 functions live in `supabase/functions/` (see
[supabase/functions/README.md](./supabase/functions/README.md) for every payload).
The pure engine is **copied** into `_shared/engine/` from `lib/engine` — edit the
source of truth in `lib/engine` and re-sync.

```bash
cd artifacts/fleet-arena
bash supabase/functions/scripts/sync-engine.sh   # refresh the engine copy

# Deploy all functions using the management API (no Docker needed)
supabase functions deploy --use-api
```

Functions import Deno modules using the **`npm:` specifier** convention
(e.g. `import { createClient } from 'npm:@supabase/supabase-js'`). `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into the
runtime by the platform.

## Running the app (Replit)

Start Expo via the Replit workflow (the `dev` script wires the Replit proxy
domains):

```bash
pnpm --filter @workspace/fleet-arena run dev
```

The Replit **Fleet Arena** artifact preview serves the web build at `/`.

### Testing on a physical device (Expo Go)

1. Install **Expo Go** on your iPhone/Android.
2. Start the dev server; open the Expo dev tools and scan the **QR code**.
3. The app loads over the Replit tunnel.

Expo Go covers most of the app. A few features need a custom **development
build** (not Expo Go): remote **push notifications** and native **social
sign-in**. See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

## Quality scripts & tests

```bash
cd artifacts/fleet-arena
pnpm run typecheck   # tsc -p tsconfig.json --noEmit (strict)
pnpm run lint        # expo lint
pnpm run test        # vitest — pure engine suite (lib/engine/**/*.test.ts)
```

CI runs the same gates. Because the workspace does not use GitHub Actions, an
example workflow is provided at
[`.github-ci-example/ci.yml`](./.github-ci-example/ci.yml) — copy it to the repo
root `.github/workflows/ci.yml` to enable it.

## EAS builds & store submission

`eas.json` defines `development`, `preview` and `production` profiles
(`cli.version >= 16`, `appVersionSource: remote`). Bundle IDs are
`com.fleetarena.game` (iOS & Android); URL scheme is `fleetarena`.

```bash
# Reference commands — NOT run inside Replit (see note below)
eas build --profile preview  --platform all
eas build --profile production --platform all
eas submit --profile production --platform ios      # → TestFlight
eas submit --profile production --platform android  # → Play Internal testing
```

> **On Replit, iOS publishing goes through Replit's Expo Launch flow.** The EAS
> CLI commands above are documented for completeness and for use outside Replit;
> they are not executed in this environment. See
> [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

## Deep links

The app registers the `fleetarena://` scheme (plus Expo universal links). Private
match invites resolve to `fleetarena://online/join/<code>` (see
`app/online/join/[code].tsx`). `create-private-match` returns both a `deepLink`
and a `universalLink`.

## Push notifications

Handled in `features/notifications/`. The client explains the benefit before
prompting for OS permission, then registers the Expo push token via the
`register-push-token` Edge Function. **Remote push requires a development /
standalone build** — it is a safe no-op in Expo Go and on web.

## Apple / Google Sign-In

Social OAuth is **stubbed behind a feature flag** (`SOCIAL_AUTH_ENABLED = false`
in `features/auth/oauth.ts`). The buttons only render when the flag is on, and
the handlers intentionally throw. Enabling it needs a development build with the
native auth modules **and** provider configuration in the Supabase dashboard.
Email/password + magic-link auth work today.

## Security model (summary)

- Client uses the **anon key** only; every sensitive operation is enforced by
  **RLS** or performed inside Edge Functions with the **service_role** key.
- `private_game_states` (secret boards) has RLS enabled with **no permissive
  policy** — only the service_role can read/write it. Clients submit shots via
  `fire-shot`, which resolves hits against the hidden board.
- `profiles` never expose email; privileged columns can't be self-escalated.
- Gameplay writes (moves, results, ratings) happen server-side so results can't
  be forged. Blocks hide users across profiles/friends/matchmaking.

Full details: [SECURITY.md](./SECURITY.md), [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
and [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).

## Remaining external steps (honest list)

These require accounts/config outside this repo:

- Create the production Supabase project; set `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`.
- Apply migrations & deploy Edge Functions to production; do **not** seed.
- Configure Supabase Auth providers (redirect URLs; Apple/Google for social).
- Apple Developer + Google Play Console enrollment; create app records.
- Provide real store assets (see [ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)).
- Host the legal/support pages referenced by the `EXPO_PUBLIC_*_URL` vars.
- (Optional) Sentry project + DSN; a real IAP provider for the shop.

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for what is intentionally
stubbed/limited.
