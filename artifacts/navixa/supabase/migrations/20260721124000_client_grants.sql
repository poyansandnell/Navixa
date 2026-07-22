-- =============================================================================
-- Client role grants (applied 2026-07-21)
-- Earlier migrations revoked table privileges broadly, but PostgREST needs the
-- base SQL grants in addition to RLS policies: RLS filters rows, grants gate
-- the verb. Without SELECT grants every client query returned 403.
-- Server-only surfaces (private_game_states, audit_logs, privileged functions)
-- stay revoked as defense-in-depth on top of their RLS/definer design.
-- =============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- Server-only tables: never readable/writable by client roles.
revoke all on public.private_game_states from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

-- Future tables created without explicit grants default to client access
-- (RLS still applies); server-only tables must revoke explicitly like above.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
