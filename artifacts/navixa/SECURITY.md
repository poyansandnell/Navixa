# Navixa — Security Model

Navixa is designed so a malicious client cannot cheat, read secret data, or
escalate privileges. The client never talks to the database directly; every
trust boundary is enforced by the **server-authoritative** Express api-server
(`artifacts/api-server`), which authenticates each request with a **Clerk**
session JWT and runs all game logic server-side over Replit PostgreSQL.

Full schema-level detail lives in the Drizzle schema (`lib/db`); this file is
the security-focused summary.

## Keys & secrets
- Client: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (Clerk client key) +
  `EXPO_PUBLIC_DOMAIN` only. These are public by design.
- **`CLERK_SECRET_KEY`** and **`DATABASE_URL`**: server-side only, provided to
  the api-server via Secrets. They **must never** appear in a client env var or
  the app bundle.
- No secret is committed; `.env.example` contains placeholders only.

## Trust boundaries
- **Secret boards (`private_game_states`)** — read/written **only** by the
  api-server; never returned to any client. Clients never receive the
  opponent's board.
- **Gameplay** — clients cannot write `matches`, `match_moves`,
  `match_players`, or `match_events`. Shots are submitted to the matches API,
  which resolves the hit against the hidden board, enforces turn order/match
  state, and is **idempotent** on `(match_id, idempotency_key)`. Results and
  ratings (Glicko-2/Elo) are applied server-side (`finalize_match`,
  `update_rating`) so they cannot be forged.
- **Matchmaking** — queue joins run in a transaction using
  `SELECT ... FOR UPDATE SKIP LOCKED` so two players cannot be paired twice.
- **Profiles** — never expose email (email lives only in Clerk). Privileged
  columns (`is_admin`, `is_bot`, `is_verified`, `xp`, `level`) can only be set
  server-side; there is no client path to self-escalate.
- **Admin** — admin-only routes are gated by a server-side `is_admin` check;
  there is no client path to set `is_admin`.
- **Blocks** — the server filters blocked users out of profile reads, friend
  requests, and matchmaking.

## API surface
Every api-server route: verifies the caller's Clerk JWT (`requireAuth`),
zod-validates the payload, enforces permissions/match state, and writes
`audit_logs` for critical events. Errors use a stable envelope
`{ error: { code, message } }`. The shared pure engine is imported from
`lib/game-engine` (source of truth) — no copying.

## Realtime
Socket.IO is mounted at path `/api/socket.io`. The connection handshake carries
the Clerk session JWT (`handshake.auth.token`); unauthenticated sockets are
rejected. The server only emits match/matchmaking/notification/friend events to
the rooms the authenticated user is entitled to.

## Data-access model
The api-server is the only component with database credentials; all reads and
writes go through it. Catalog data (cosmetics, quests, tournaments) is exposed
read-only; per-user data is owner-scoped by the server; trusted writes
(ratings, results, grants, moderation, audit) are performed server-side.

## Auth
- **Email/password + Google (Clerk SSO) only** — a real account is always
  required. Custom in-app sign-in/sign-up screens.
- **Apple** Sign-In is not wired up yet. There is no guest/anonymous mode and no
  magic-link sign-in.
- Sessions are managed by Clerk (`@clerk/expo`); tokens are refreshed
  automatically and used as bearer tokens for REST and Socket.IO.

## Privacy / data-subject requests
- `GET /api/account/export` returns the caller's own data (no other user, no
  `private_game_states`).
- `POST /api/account/delete` hard-deletes the profile (FK cascades remove owned
  rows) and deletes the Clerk user; deactivates push tokens. Refused while a
  match is active. See [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).

## Device permissions
The app requests **no** camera, microphone, location, or contacts access. Push
notification permission is requested only after an in-app explanation, and only
in builds that support remote push.

## Reporting a vulnerability
Report suspected vulnerabilities privately to the support contact configured in
`EXPO_PUBLIC_SUPPORT_EMAIL`. Do not open public issues for security reports.
