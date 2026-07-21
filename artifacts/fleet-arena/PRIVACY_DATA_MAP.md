# Fleet Arena — Privacy & Data Map

What data Fleet Arena collects, where it lives, why, and how users exercise
their rights. This maps to the store privacy questionnaires (App Store "App
Privacy" and Google Play "Data safety").

## Data collected
| Data | Where stored | Purpose | Linked to user |
|------|--------------|---------|----------------|
| Email | `auth.users` (Supabase Auth) — **never** in `profiles` | Account / login | Yes |
| Auth session tokens | Device (AsyncStorage), Supabase Auth | Keep signed in | Yes |
| Display name, avatar, country, bio | `profiles` | Public profile, leaderboards | Yes |
| App settings / preferences | `user_settings` | Personalization (haptics, sound, motion, language, notification opt-ins) | Yes |
| Ratings / rating history | `ratings`, `rating_history` | Elo, matchmaking, leaderboards | Yes |
| Match data (matches, players, moves, events) | `matches`, `match_players`, `match_moves`, `match_events` | Gameplay, history, replays, anti-cheat | Yes |
| Secret board layouts | `private_game_states` (service_role only) | Game integrity | Yes (never exposed to clients) |
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
- Clients use the **anon key**; RLS restricts reads to the user's own rows or
  public/spectatable data. Emails are never readable by other users.
- No data is sold. Data is processed by Supabase (backend) and, if configured,
  Sentry (crash reporting) and Expo push (notification delivery).

## User rights (self-service)
- **Export** — `export-user-data` Edge Function returns the user's own data as
  JSON (excludes other users and `private_game_states`).
- **Delete** — `delete-account` Edge Function anonymises + soft-deletes the
  profile, deactivates push tokens, and hard-deletes the auth user (cascades).
  Refused while a match is active.
- **Notification control** — per-category opt-ins in Settings (`user_settings`).

## Retention
- Active account data persists until deletion. Soft-deleted rows
  (`deleted_at`) are retained per operational policy; hard deletion removes the
  auth user and cascades.

## Regions
Country is user-provided (profile), used for leaderboards/regional matchmaking —
not derived from device location.
