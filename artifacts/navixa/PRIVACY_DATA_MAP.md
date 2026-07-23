# Navixa — Privacy & Data Map

What data Navixa collects, where it lives, why, and how users exercise
their rights. This maps to the store privacy questionnaires (App Store "App
Privacy" and Google Play "Data safety").

## Data collected
| Data | Where stored | Purpose | Linked to user |
|------|--------------|---------|----------------|
| Email | Clerk (managed auth) — **never** in `profiles` | Account / login | Yes |
| Auth session tokens | Device (Clerk `@clerk/expo` storage) | Keep signed in | Yes |
| Display name, avatar, country, bio | `profiles` | Public profile, leaderboards | Yes |
| App settings / preferences | `user_settings` | Personalization (haptics, sound, motion, language, notification opt-ins) | Yes |
| Ratings / rating history | `ratings`, `rating_history` | Elo, matchmaking, leaderboards | Yes |
| Match data (matches, players, moves, events) | `matches`, `match_players`, `match_moves`, `match_events` | Gameplay, history, replays, anti-cheat | Yes |
| Secret board layouts | `private_game_states` (api-server only) | Game integrity | Yes (never exposed to clients) |
| Social graph | `friend_requests`, `friendships`, `blocks` | Friends / blocking | Yes |
| Reports | `reports`, `moderation_actions` | Trust & safety | Yes |
| Push tokens | `push_tokens`, `devices` | Turn / social notifications | Yes |
| Notifications | `notifications` | In-app alerts | Yes |
| Cosmetics / quests / achievements | `user_inventory`, `equipped_cosmetics`, `user_quests`, `user_achievements` | Progression, shop (test currency) | Yes |
| Audit logs | `audit_logs` | Security / abuse investigation | Yes |

## NOT collected
- No camera, microphone, **precise or coarse location**, or contacts access.
- No real-money payment data (shop uses test currency only — see
  [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).
- No third-party ad/tracking SDKs. Optional crash reporting (Sentry) only if a
  DSN is configured (`EXPO_PUBLIC_SENTRY_DSN`).

## Access & sharing
- Clients never access the database directly; the server-authoritative
  api-server restricts reads to the user's own rows or public/spectatable data.
  Emails are never readable by other users (email lives in Clerk).
- No data is sold. Data is processed by Replit (PostgreSQL/hosting), Clerk
  (authentication) and, if configured, Sentry (crash reporting) and Expo push
  (notification delivery).

## User rights (self-service)
- **Export** — `GET /api/account/export` returns the user's own data as JSON
  (excludes other users and `private_game_states`).
- **Delete** — `POST /api/account/delete` hard-deletes the profile (FK cascades
  remove owned rows), deactivates push tokens, and deletes the Clerk user.
  Refused while a match is active.
- **Notification control** — per-category opt-ins in Settings (`user_settings`).

## Retention
- Active account data persists until deletion. Soft-deleted rows
  (`deleted_at`) are retained per operational policy; hard deletion removes the
  profile (FK cascades) and deletes the Clerk user.

## Regions
Country is user-provided (profile), used for leaderboards/regional matchmaking —
not derived from device location.
