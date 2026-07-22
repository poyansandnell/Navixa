# Navixa — Supabase Setup

This document explains how to apply the database schema, run the seed data, and
the security model the schema enforces. The project targets **PostgreSQL 17**
(see `supabase/config.toml` → `[db] major_version = 17`).

> The Navixa app is an Expo React Native client. It talks to Supabase using
> the **anon key** (see `lib/supabase.ts`). Everything sensitive is enforced by
> Row Level Security (RLS) and by keeping privileged writes inside Edge
> Functions that use the **service_role key**.

---

## 1. Migration files

Migrations live in `supabase/migrations/` and are applied in filename (timestamp)
order:

| Order | File | Contents |
|-------|------|----------|
| 00 | `20260721120000_extensions_and_helpers.sql` | Extensions (`pgcrypto`, `citext`), enum types, shared triggers, `is_admin()`, `is_blocked_between()` |
| 01 | `20260721120100_profiles_and_identity.sql` | `profiles`, `user_settings`, `devices`, `push_tokens`, new-user trigger, privileged-column guard |
| 02 | `20260721120200_social.sql` | `friend_requests`, `friendships`, `blocks`, `reports`, `accept_friend_request()` |
| 03 | `20260721120300_matches_and_game.sql` | `matches`, `match_players`, `private_game_states`, `match_moves`, `match_events` |
| 04 | `20260721120400_matchmaking_and_ratings.sql` | `matchmaking_queue`, `ratings`, `rating_history`, `leaderboard_snapshots` |
| 05 | `20260721120500_tournaments.sql` | `tournaments`, `tournament_entries`, `tournament_rounds`, `tournament_matches` |
| 06 | `20260721120600_quests_achievements_cosmetics.sql` | `daily_quests`, `user_quests`, `achievements`, `user_achievements`, `cosmetic_items`, `user_inventory`, `equipped_cosmetics` |
| 07 | `20260721120700_notifications_moderation_config.sql` | `notifications`, `moderation_actions`, `audit_logs`, `app_config` |
| 08 | `20260721120800_functions.sql` | `update_rating`, `matchmaking_find_or_queue`, `finalize_match`, `player_stats`, `generate_leaderboard_snapshot`, `tournament_advance_winner`, grants |

**32 tables** total, all with `uuid` primary keys (`default gen_random_uuid()`,
except `profiles.id` which references `auth.users.id`), FKs, indexes, unique &
check constraints, `created_at`/`updated_at` (with an `updated_at` trigger), and
`deleted_at` soft-delete where sensible. RLS is enabled with policies inline in
each migration.

---

## 2. Applying the migrations

### Option A — Supabase CLI (recommended)

From `artifacts/fleet-arena/`:

```bash
# Local dev stack (Docker): create the DB, run all migrations, then seed.sql
supabase db reset

# Push migrations to the linked remote project (does NOT run seed.sql)
supabase db push
```

`supabase db reset` recreates the local database and automatically runs every
migration in order followed by `supabase/seed.sql`. `supabase db push` applies
pending migrations to the linked hosted project.

### Option B — Raw `psql`

```bash
# Apply migrations in order
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# (Dev/preview only) load seed data
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

> Do **not** run `seed.sql` against production — it inserts 20 fake accounts
> directly into `auth.users`.

---

## 3. Seed data (`supabase/seed.sql`) — DEV / PREVIEW ONLY

Creates a playable-looking preview environment:

- **20 demo players** with varied countries (SE, NO, FI, DK, GB, DE, FR, ES, IT,
  US, CA, BR, JP, KR, AU, IN, ZA) and ratings (~1290–2500).
- Finished **match history** with `match_players`, `match_moves`, `match_events`.
- **Friendships** and a pending **friend request**.
- **Achievements** catalog + unlocks for a top player.
- **Cosmetic test products** (themes, ship skins, frames, emotes, titles) with
  coin/real-money prices, plus default grants + equips.
- **Daily/weekly quests** + one in-progress user quest.
- One **upcoming** tournament (registration open) and one **ongoing** tournament
  with a live semifinal bracket.
- Public **app_config** flags.

The seed temporarily disables the `on_auth_user_created` trigger so it can seed
profiles with explicit country/rating variety, then re-enables it.

---

## 4. Security model

### `private_game_states` — service-role only
Each player's secret board layout lives in `private_game_states`. RLS is
**enabled with NO permissive policy**, so anon/authenticated roles are denied by
default. Only the **service_role** (Edge Functions) can read/write it. Clients
never receive the opponent's board; they submit shots via an Edge Function which
resolves the hit against the private state.

### `profiles` never expose email
Emails live only in `auth.users`. The public `profiles` table has no email
column. Profiles are readable by anyone who isn't blocked and whose row isn't
soft-deleted. Privileged columns (`is_admin`, `is_bot`, `is_verified`, `xp`,
`level`) cannot be self-escalated: a `BEFORE UPDATE` trigger resets them to their
old values unless the caller is an admin.

### `matches` is public metadata
`matches` is spectatable public metadata (private matches are restricted to
participants until finished). No client INSERT/UPDATE policies exist — gameplay
writes happen through Edge Functions with the service_role key so players can't
forge moves or results.

### `match_moves` visibility
Readable by participants during play, and by **anyone once the match is
finished** (`status in ('finished','abandoned')`) to support replays. Same rule
for `match_players` and `match_events`.

### Blocks hide users
`is_blocked_between(a, b)` (SECURITY DEFINER) powers policies so blocked users
disappear from profile reads, can't send friend requests, and are skipped by
matchmaking.

### Admin role
`profiles.is_admin` is checked **server-side** via `is_admin()` (SECURITY
DEFINER) inside admin RLS policies. There is no client path to set it.

### RLS everywhere
Every table has `ENABLE ROW LEVEL SECURITY`. Catalog tables (`cosmetic_items`,
`achievements`, `daily_quests`, `tournaments`, `ratings`, `leaderboard_snapshots`)
are publicly readable for active/non-draft rows; per-user tables are owner-scoped;
writes that must be trusted (ratings, results, grants, moderation, audit) are
performed by the service_role which bypasses RLS.

---

## 5. Server-side functions

`SECURITY DEFINER` functions pin `search_path = public`. Client-callable RPCs are
granted to `authenticated` (and `anon` where safe); trusted server functions are
`REVOKE`d from `public` and only invoked with the service_role key.

| Function | Caller | Notes |
|----------|--------|-------|
| `matchmaking_find_or_queue(...)` | authenticated | Transactional; can't match self; widening rating window; skips blocked users; `FOR UPDATE SKIP LOCKED` prevents duplicate matches |
| `player_stats(uuid)` | authenticated / anon | Read-only aggregate |
| `accept_friend_request(uuid)` | authenticated | Receiver-only; creates canonical friendship |
| `update_rating(...)` | service_role | Elo update + `rating_history` |
| `finalize_match(...)` | service_role | **Idempotent** (guards on match status); applies ratings for rated matches |
| `generate_leaderboard_snapshot(...)` | service_role | Idempotent per (date, scope, mode) |
| `tournament_advance_winner(...)` | service_role | Idempotent bracket advancement |

---

## 6. Notes

- Do **not** create `app.config.ts`; the app uses static `app.json`.
- Do not commit real secrets. The client only ever uses
  `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- The service_role key must only be used inside Edge Functions / trusted
  backend contexts — never shipped to the client.
