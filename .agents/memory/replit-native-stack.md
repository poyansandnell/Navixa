---
name: Replit-native stack (post-Supabase)
description: Architecture after the July 2026 migration off Supabase — where auth, DB, realtime, and game logic live now.
---

Navixa migrated fully off Supabase (July 23, 2026). Do not reintroduce Supabase clients, env vars, or edge functions.

- **DB**: Replit PostgreSQL via `DATABASE_URL`; Drizzle schema in `lib/db` (one file per domain, text Clerk user ids, uuid entity ids). Dev→prod schema sync happens automatically on Publish — never write prod migration scripts.
- **Auth**: Replit-managed Clerk (email/password + Google). Custom in-app screens in Expo (`@clerk/expo`, note: v4 default hooks are the signals API — auth screens use `@clerk/expo/legacy`). Anonymous/guest and magic-link login were removed (unsupported by managed Clerk).
- **Game server**: `artifacts/api-server` is server-authoritative (engine in `lib/game-engine`): fire-shot validation, matchmaking via FOR UPDATE SKIP LOCKED, ~1s timeout sweep, server-driven bot moves, Expo push.
- **Realtime**: Socket.IO at path `/api/socket.io` (so the shared proxy routes it); Clerk token in `handshake.auth.token`. Events: matchmaking:matched, match:update/move/event, notification:new, friend:event.
- **Why:** user mandate — no Supabase secrets, no Replit Auth (players must not need Replit accounts), fully branded accounts.
- **How to apply:** any new persistent feature goes through lib/db + api-server routes + socket emits; the Expo app talks only to `https://$EXPO_PUBLIC_DOMAIN/api`.

Old SUPABASE_* secrets still exist in the workspace but are unused; user can delete them.
