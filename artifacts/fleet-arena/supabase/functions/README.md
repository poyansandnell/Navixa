# Fleet Arena — Supabase Edge Functions

The trusted, server-verified game server. Every function runs in Deno, verifies
the caller's JWT, zod-validates its payload, enforces permissions / match state
/ turn order, runs mutations through the SQL functions where they exist, writes
`audit_logs` for critical events and **never leaks `private_game_states`** to
clients.

- Invoke: `POST /functions/v1/<name>` with header `Authorization: Bearer <jwt>`
  and a JSON body.
- Errors use a stable envelope: `{ "error": { "code", "message", "details?" } }`
  (see `_shared/errors.ts` for the full `ErrorCode` union).
- The pure game engine is **copied** into `_shared/engine/` from `lib/engine`
  (the source of truth) via `scripts/sync-engine.sh`. Edit `lib/engine` and
  re-run the script; never hand-edit `_shared/engine`.

## Shared modules (`_shared/`)

| File | Purpose |
|------|---------|
| `cors.ts` | CORS headers + preflight + `jsonResponse` |
| `serve.ts` | `serveJson()` wrapper: preflight, POST-only, error serialisation |
| `auth.ts` | `requireUser(req)` — verifies the JWT via supabase-js `auth.getUser()` |
| `db.ts` | `serviceClient()` (service_role) + `writeAudit()` |
| `errors.ts` | `AppError`, `appError()`, `errorResponse()`, `mapEngineError()` |
| `validate.ts` | zod schemas + `parseBody()` |
| `push.ts` | Expo push API client |
| `match-helpers.ts` | load match/players/private states, rebuild engine `MatchState`, run `applyShot`, persist moves/turn/clock |
| `engine/` | copy of `lib/engine` (Deno-compatible) |

## Functions & payloads

Types below use TS-ish notation; all are validated with zod. Optional fields
show a default where one applies.

### join-matchmaking
`{ mode?: 'ranked'|'casual'|'friendly'|'tournament'|'bot' = 'ranked', boardSize?: 8..16 = 10, region?: string }`
→ `{ matched, matchId, status }`. Uses `matchmaking_find_or_queue()`.

### leave-matchmaking
`{ mode?: match_mode = 'ranked' }` → `{ cancelled }`.

### create-private-match
`{ mode?: 'casual'|'friendly' = 'friendly', boardSize?: 8..16 = 10, turnSeconds?: 10..600 = 60, isRated?: boolean = false }`
→ `{ matchId, code, deepLink, universalLink }`. Uses `create_private_match()`.

### join-private-match
`{ code: string(4..12) }` → `{ matchId, status }`. Uses `join_private_match()`.

### submit-fleet
`{ matchId: uuid, fleet: Placement[], boardHash?: string, salt?: string }`
→ `{ ok, ready, matchStarted }`. Validates via engine `validateFleet`, stores
the secret board in `private_game_states`, activates the match + stamps the
first turn clock once both seats are in. Auto-places a bot's fleet for `bot`
matches.

### fire-shot
`{ matchId: uuid, x: int, y: int, idempotencyKey: string(8..128) }`
→ `{ idempotent, result, sunkShip, moveNumber, winner, winnerId, view, botToMove }`.
Loads both boards, replays via `applyShot`, persists the move (idempotent on
`(match_id, idempotency_key)`), flips the turn + clock, finalises + rates on a
win. `view` is the redacted `PublicMatchState` for the shooter.

### bot-move
`{ matchId: uuid }` → `{ botShot, result, sunkShip, moveNumber, winner, winnerId, view }`.
Server plays the bot's turn using **only** the public projection of the match
(the bot never sees the human's board). `bot` matches only.

### resign-match
`{ matchId: uuid }` → `{ ok, winnerId, abandoned }`. Forfeits the caller;
opponent wins via `finalize_match()`.

### handle-timeout
`{ matchId: uuid }` → `{ ok, timedOut, winnerId }`. Server-verified against
`matches.turn_deadline`; the player on the clock loses. `NOT_TIMED_OUT` if the
deadline has not passed.

### reconnect-match
`{ matchId: uuid }` → full redacted `view` + `{ status, seat, yourTurn, winnerId, clock }`.
`clock` carries `turnDeadline`, `currentTurnRemainingMs` and per-player
`timeLeftMs`.

### finalize-match
`{ matchId: uuid }` → `{ ok, alreadyFinal, winnerId }`. Idempotent; recomputes
the winner from the private boards and only finalises when a fleet is fully
sunk.

### register-push-token
`{ token: string, platform: 'ios'|'android'|'web', provider?: 'expo'|'fcm'|'apns' = 'expo', deviceId?: uuid }`
→ `{ ok }`. Upserts on the unique token.

### report-user
`{ reportedId: uuid, category: 'harassment'|'cheating'|'inappropriate_name'|'spam'|'other', description?: string, matchId?: uuid }`
→ `{ ok, reportId }`.

### delete-account
`{ confirm: true }` → `{ ok }`. Refuses while an active/placing match exists.
Anonymises + soft-deletes the profile, deactivates push tokens, then hard-
deletes the auth user (cascades).

### export-user-data
`{}` → a JSON document of the caller's profile, settings, ratings, history,
matches, social graph, notifications, tokens and reports. No other user's data
and no `private_game_states`.

### create-tournament-bracket
`{ tournamentId: uuid }` → `{ ok, rounds, alreadyExisted }`. Admin/creator only.
Uses idempotent `create_tournament_bracket()`.

### advance-tournament
`{ tournamentMatchId: uuid, winnerId: uuid }` → `{ ok }`. Admin/creator only.
Uses idempotent `tournament_advance_winner()`.

### send-turn-notification
`{ matchId: uuid, userId: uuid }` → `{ ok, pushed, ... }`. Creates the in-app
`your_turn` notification and sends an Expo push when the recipient opted in and
has active Expo tokens.

## SQL support

Base SQL functions live in `supabase/migrations/20260721120800_functions.sql`
(`update_rating`, `matchmaking_find_or_queue`, `finalize_match`,
`tournament_advance_winner`, …). Edge-function-specific helpers were added in
`supabase/migrations/20260721121000_edge_function_support.sql`
(`create_private_match`, `join_private_match`, `create_bot_match`,
`touch_turn_clock`, `create_tournament_bracket`) plus the columns they need
(`matches.invite_code`, `matches.turn_deadline`, `match_players.time_left_ms /
is_bot / bot_difficulty`, `match_moves.idempotency_key`, bot-seat support on
`private_game_states`). **Do not apply migrations by hand** — the platform / CLI
applies them in timestamp order.

## Deploy

```bash
# From artifacts/fleet-arena/
bash supabase/functions/scripts/sync-engine.sh   # refresh the engine copy
supabase functions deploy                         # deploy all functions
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are auto-
injected into the function runtime by the platform.
