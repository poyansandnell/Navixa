---
name: Supabase setup for Fleet Arena
description: How Supabase is wired in this project and what NOT to do
---

- The Replit Supabase connector is broken/unusable per the user — **do not** propose or use the Replit Supabase connector. Use env vars/secrets instead.
- Client config: `EXPO_PUBLIC_SUPABASE_URL` (shared env var) + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Replit Secret). Expo client at `artifacts/fleet-arena/lib/supabase.ts`.
- **Why:** user explicitly directed this after the connector failed (July 2026).
- **How to apply:** never require `SUPABASE_DB_URL` or `SUPABASE_SERVICE_ROLE_KEY` in the Expo client. If migrations or privileged server ops are needed, build them separately and **ask the user before requesting any additional secret**.
- Supabase project ref: dzvliczifopxkwpcikzf (user calls it "Navixa").
