# Navixa — Security Model

Navixa is designed so a malicious client cannot cheat, read secret data, or
escalate privileges. The client only ever holds the Supabase **anon key**; all
trust boundaries are enforced by Postgres **Row Level Security (RLS)** and by
**Edge Functions** that use the **service_role** key server-side.

Full schema-level detail lives in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md); this
file is the security-focused summary.

## Keys & secrets
- Client: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` only
  (`lib/supabase.ts`). These are public by design.
- **service_role** key: server-side only, auto-injected into the Edge Function
  runtime. It **must never** appear in a client env var or the app bundle.
- No secret is committed; `.env.example` contains placeholders only.

## Trust boundaries
- **Secret boards (`private_game_states`)** — RLS enabled with **no permissive
  policy**, so anon/authenticated are denied by default. Only the service_role
  reads/writes it. Clients never receive the opponent's board.
- **Gameplay** — `matches`, `match_moves`, `match_players`, `match_events` have
  **no client INSERT/UPDATE** policies. Shots are submitted to the `fire-shot`
  Edge Function, which resolves the hit against the hidden board, enforces turn
  order/match state, and is **idempotent** on `(match_id, idempotency_key)`.
  Results and Elo are applied server-side (`finalize_match`, `update_rating`) so
  they cannot be forged.
- **Profiles** — never expose email (email lives only in `auth.users`).
  Privileged columns (`is_admin`, `is_bot`, `is_verified`, `xp`, `level`) are
  protected by a `BEFORE UPDATE` trigger that resets self-escalation attempts.
- **Admin** — `is_admin()` (SECURITY DEFINER) gates admin RLS policies; there is
  no client path to set `is_admin`.
- **Blocks** — `is_blocked_between()` powers policies so blocked users disappear
  from profile reads, friend requests, and matchmaking.

## Edge Functions
Every function (18 total, `supabase/functions/`): verifies the caller JWT
(`requireUser`), zod-validates the payload, enforces permissions/match state,
and writes `audit_logs` for critical events. Errors use a stable envelope
`{ error: { code, message, details? } }`. The pure engine is copied into
`_shared/engine/` from `lib/engine` (source of truth).

## RLS coverage
Every table has `ENABLE ROW LEVEL SECURITY`. Catalog tables are publicly
readable for active/non-draft rows; per-user tables are owner-scoped; trusted
writes (ratings, results, grants, moderation, audit) run under the service_role
which bypasses RLS. `SECURITY DEFINER` functions pin `search_path = public`.

## Auth
- Email/password + magic-link via Supabase Auth.
- Social OAuth (Apple/Google) is **stubbed** and disabled
  (`SOCIAL_AUTH_ENABLED = false`); enabling requires provider config + a dev
  build (see [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).
- Sessions persist via AsyncStorage on native; auto-refresh while foregrounded.

## Privacy / data-subject requests
- `export-user-data` returns the caller's own data (no other user, no
  `private_game_states`).
- `delete-account` anonymises + soft-deletes the profile, deactivates push
  tokens, then hard-deletes the auth user (cascades). Refused while a match is
  active. See [PRIVACY_DATA_MAP.md](./PRIVACY_DATA_MAP.md).

## Device permissions
The app requests **no** camera, microphone, location, or contacts access. Push
notification permission is requested only after an in-app explanation, and only
in builds that support remote push.

## Reporting a vulnerability
Report suspected vulnerabilities privately to the support contact configured in
`EXPO_PUBLIC_SUPPORT_EMAIL`. Do not open public issues for security reports.
