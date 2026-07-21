/**
 * Fleet Arena — tournament data access.
 *
 * Reads the public tournament tables via the anon Supabase client (RLS allows
 * public read of non-draft tournaments, entries, rounds and matches).
 * Registration is a direct insert into `tournament_entries` and withdrawal a
 * delete — both permitted by the `tournament_entries_register` /
 * `_withdraw` RLS policies (player_id must equal auth.uid()).
 *
 * Max-participant enforcement is best-effort on the client (we count existing
 * entries before inserting); the authoritative check lives server-side.
 */
import { supabase } from '@/lib/supabase';
import type {
  Tournament,
  TournamentEntry,
  TournamentMatch,
  TournamentRound,
} from './types';

/** Fetch visible tournaments ordered by soonest start first. */
export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select(
      'id, name, description, format, status, max_players, min_players, registration_opens_at, registration_closes_at, starts_at, ends_at',
    )
    .neq('status', 'draft')
    .is('deleted_at', null)
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Tournament[];
}

/** Fetch all entries for a set of tournaments (used for counts + my status). */
export async function fetchEntries(
  tournamentIds: string[],
): Promise<TournamentEntry[]> {
  if (tournamentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('tournament_entries')
    .select(
      'id, tournament_id, player_id, seed, final_rank, wins, losses, eliminated',
    )
    .in('tournament_id', tournamentIds);
  if (error) throw error;
  return (data ?? []) as TournamentEntry[];
}

/** Rounds for one tournament, ordered by round number. */
export async function fetchRounds(
  tournamentId: string,
): Promise<TournamentRound[]> {
  const { data, error } = await supabase
    .from('tournament_rounds')
    .select('id, tournament_id, round_number, name, status')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TournamentRound[];
}

/** Bracket matches for one tournament, ordered by bracket position. */
export async function fetchMatches(
  tournamentId: string,
): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select(
      'id, tournament_id, round_id, bracket_position, player_one_id, player_two_id, winner_id, status',
    )
    .eq('tournament_id', tournamentId)
    .order('bracket_position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TournamentMatch[];
}

/** Fetch display names for a set of player ids (for bracket rendering). */
export async function fetchPlayerNames(
  ids: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', unique);
  if (error || !data) return new Map();
  const map = new Map<string, string>();
  for (const row of data as {
    id: string;
    username: string | null;
    display_name: string | null;
  }[]) {
    map.set(row.id, row.display_name ?? row.username ?? row.id.slice(0, 6));
  }
  return map;
}

export interface RegisterResult {
  ok: boolean;
  reason?: 'full' | 'error';
}

/**
 * Register the current user for a tournament. Counts existing entries first to
 * respect `max_players` (server-side RLS/triggers remain the source of truth).
 */
export async function registerForTournament(
  tournamentId: string,
  playerId: string,
  maxPlayers: number,
): Promise<RegisterResult> {
  const { count, error: countError } = await supabase
    .from('tournament_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);
  if (countError) return { ok: false, reason: 'error' };
  if ((count ?? 0) >= maxPlayers) return { ok: false, reason: 'full' };

  const { error } = await supabase
    .from('tournament_entries')
    .insert({ tournament_id: tournamentId, player_id: playerId });
  if (error) return { ok: false, reason: 'error' };
  return { ok: true };
}

/** Withdraw the current user from a tournament. */
export async function unregisterFromTournament(
  tournamentId: string,
  playerId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_entries')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId);
  return !error;
}
