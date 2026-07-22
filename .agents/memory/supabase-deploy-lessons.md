---
name: Supabase CLI + Postgres lessons (Navixa)
description: How to deploy Edge Functions and manage grants/auth config for the external Supabase project from this workspace
---

- **Edge Function deploys**: local Docker bundling fails (package firewall DNS). Use `pnpm dlx supabase functions deploy <fn> --use-api` from `artifacts/navixa/`, and delete `supabase/functions/deno.lock` if present. The API bundler ignores `deno.json` import maps — all imports must use explicit specifiers like `npm:@supabase/supabase-js@2`, `npm:zod@3.23.8`.
- **Grants AND RLS are both required**: RLS policies filter rows, but PostgREST also needs base SQL grants (`grant select ... to anon, authenticated`). Revoking table grants "for security" made every client query 403. Fix + default privileges live in `supabase/migrations/20260721124000_client_grants.sql`; keep `private_game_states` and `audit_logs` revoked.
- **Pooled DB role can't alter `auth.users` triggers** ("must be owner of table users") — seed scripts must upsert around the `handle_new_user` trigger instead of disabling it.
- **Auth provider config** (anonymous sign-in, mailer autoconfirm) is toggled via the management API: `PATCH https://api.supabase.com/v1/projects/<ref>/config/auth` with `$SUPABASE_ACCESS_TOKEN`. Anonymous sign-ins were off by default (guest login 422 until enabled).
- Apply migrations with `psql "$SUPABASE_DB_URL" -f <file>` (verified working); `supabase db push` not needed.
