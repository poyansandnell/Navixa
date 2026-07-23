# Navixa

A global, multiplayer **Battleship** game built for the Expo showcase. Navixa is an Expo React Native app (iOS / Android / web) backed by Replit-native infrastructure: a Replit **PostgreSQL** database (Drizzle schema in `lib/db`) and a server-authoritative Express **api-server** (`artifacts/api-server`) with Socket.IO realtime and Clerk auth. It ships offline bot matches,
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
| Game engine | Pure TypeScript in `lib/game-engine` (shared workspace package, no RN imports) — placement, RNG, bots, Glicko-2/Elo rating, match state, simulation; tested with Vitest |
| i18n | i18next + react-i18next + expo-localization; base locales in `i18n/locales`, extra strings merged from `i18n/partials` in `i18n/index.ts` |
| Backend | Server-authoritative Express **api-server** (`artifacts/api-server`) on Replit PostgreSQL; Drizzle schema in `lib/db`; all game logic, matchmaking (`FOR UPDATE SKIP LOCKED`), Glicko-2/Elo ratings, timeouts, server-driven bot moves, and Expo push run server-side |
| Client SDK | Typed REST client `lib/api.ts` (`/api`) + Socket.IO client `lib/socket.ts` (path `/api/socket.io`); Clerk session JWT as bearer token / handshake auth |

## Project structure

```
artifacts/navixa/
├─ app/                    expo-router routes
│  ├─ (auth)/              sign-in, sign-up, forgot-password, complete-profile
│  ├─ (tabs)/              home, compete, friends, leaderboard, profile
│  ├─ game/                offline bot match (setup → play → result)
│  ├─ online/              online play (search, private, setup, play, result, join/[code])
│  ├─ tournaments/         tournament detail
│  ├─ shop/  settings/  legal/  history/  profile/  onboarding  devtools
├─ features/              domain logic: auth, game, matchmaking, onlineMatch,
│                          tournaments, quests, shop, social, history, notifications
├─ lib/                   api client (api.ts), socket client (socket.ts), settings, devtools
├─ store/                 zustand stores (game, settings)
├─ components/            ui + game components, error boundary
├─ hooks/                 useColors, useOnboarding
├─ i18n/                  index.ts (merge), locales/, partials/
├─ assets/images/         icon.png
├─ app.json  eas.json  .env.example
└─ README.md + checklists (SETUP/RELEASE/APP_STORE/GOOGLE_PLAY/SECURITY/…)
```

The backend lives in sibling workspace packages: the Express **api-server**
(`artifacts/api-server`), the Drizzle **database schema** (`lib/db`), and the
shared **game engine** (`lib/game-engine`).

## Local setup

Prerequisites: Node 20+ and `pnpm`.

```bash
# From the workspace root — installs the whole pnpm workspace
pnpm install

# Copy the example env (see below)
cp artifacts/navixa/.env.example artifacts/navixa/.env
```

### Environment variables

Only `EXPO_PUBLIC_*` variables reach the client bundle. The two required ones
are `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk client key) and
`EXPO_PUBLIC_DOMAIN` (the Replit domain the REST/Socket.IO clients hit). On
Replit both are provided through the workspace Secrets / `userenv`. See
[`.env.example`](./.env.example) for the full list (app env, public legal/support
URLs, optional Sentry DSN).

> `CLERK_SECRET_KEY` and `DATABASE_URL` are **server-side only** and must never
> appear in a client env var. On Replit `CLERK_PUBLISHABLE_KEY` /
> `CLERK_SECRET_KEY` and `DATABASE_URL` are auto-provisioned to the api-server.

### Database (Replit PostgreSQL)

The database is Replit-native PostgreSQL; `DATABASE_URL` is auto-supplied. The
schema is defined with **Drizzle** in `lib/db` (source of truth). Dev and prod
databases are **separate**, and the prod schema is applied **automatically on
Publish** — there is no manual migration step for production.

```bash
# From lib/db — push the Drizzle schema to the current DATABASE_URL (dev)
cd lib/db
pnpm run push
```

### Seeding demo data (dev / preview only)

`lib/db/src/seed.ts` (`seedDatabase()`) creates ~20 demo players, match history,
friendships, achievements, cosmetics, quests and tournaments so preview builds
look alive. It is idempotent (every insert uses `onConflictDoNothing`) and runs
on boot **in development only**.

> **Never** seed production — the demo accounts are fake (not real Clerk users).

### The api-server

All game logic runs in the Express **api-server** (`artifacts/api-server`):
matchmaking (`FOR UPDATE SKIP LOCKED`), Glicko-2/Elo ratings, turn timeouts,
server-driven bot moves, tournaments, moderation, and Expo push. It exposes a
REST API under `/api` and Socket.IO realtime at path `/api/socket.io`; every
request/handshake is authenticated with a **Clerk** session JWT. The shared
game engine is imported from `lib/game-engine` (no copying). The server reads
`DATABASE_URL`, `CLERK_SECRET_KEY`, and `CLERK_PUBLISHABLE_KEY` from Secrets.

## Running the app (Replit)

Start Expo via the Replit workflow (the `dev` script wires the Replit proxy
domains):

```bash
pnpm --filter @workspace/navixa run dev
```

The Replit **Navixa** artifact preview serves the web build at `/`.

### Testing on a physical device (Expo Go)

1. Install **Expo Go** on your iPhone/Android.
2. Start the dev server; open the Expo dev tools and scan the **QR code**.
3. The app loads over the Replit tunnel.

Expo Go covers most of the app. A few features need a custom **development
build** (not Expo Go): remote **push notifications** and native **social
sign-in**. See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

## Quality scripts & tests

```bash
cd artifacts/navixa
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
`com.navixa.game` (iOS & Android); URL scheme is `navixa`.

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

The app registers the `navixa://` scheme (plus Expo universal links). Private
match invites resolve to `navixa://online/join/<code>` (see
`app/online/join/[code].tsx`). `create-private-match` returns both a `deepLink`
and a `universalLink`.

## Push notifications

Handled in `features/notifications/`. The client explains the benefit before
prompting for OS permission, then registers the Expo push token via the
api-server (`POST /api/notifications/register-token`); the server sends
turn/social pushes with the Expo push service. **Remote push requires a
development / standalone build** — it is a safe no-op in Expo Go and on web.

## Sign-in methods

Auth is handled by **Clerk** (Replit-managed tenant) with custom in-app
sign-in/sign-up screens. **Email/password and Google** (Clerk SSO, gated by
`SOCIAL_AUTH_ENABLED = true` in `features/auth/oauth.ts`) work today.
**Apple Sign-In is not wired up**, and **anonymous/guest and magic-link login
were removed**. In Expo Go the Google SSO redirect works via the Expo auth
proxy; a standalone build needs the app scheme registered as a Clerk redirect
URL.

## Security model (summary)

- The api-server is **server-authoritative**: every request is authenticated
  with a Clerk session JWT and all sensitive logic runs server-side. The client
  never talks to the database directly.
- `private_game_states` (secret boards) is **never sent to clients** — only the
  api-server reads/writes it. Clients submit shots via the matches API, which
  resolves hits against the hidden board.
- `profiles` never expose email (email lives in Clerk); privileged columns can't
  be self-escalated.
- Gameplay writes (moves, results, ratings) happen server-side so results can't
  be forged. Blocks hide users across profiles/friends/matchmaking.

Full details: [SECURITY.md](./SECURITY.md) and
[PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).

## Remaining external steps (honest list)

These require accounts/config outside this repo:

- Configure the production Clerk instance (providers, redirect URLs for Google
  SSO); `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` are auto-provisioned on Replit.
- On **Publish**, the production database schema is applied automatically; do
  **not** seed production.
- Apple Developer + Google Play Console enrollment; create app records.
- Provide real store assets (see [ASSETS_TO_REPLACE.md](./ASSETS_TO_REPLACE.md)).
- Host the legal/support pages referenced by the `EXPO_PUBLIC_*_URL` vars.
- (Optional) Sentry project + DSN; a real IAP provider for the shop.

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for what is intentionally
stubbed/limited.
