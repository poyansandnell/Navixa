/**
 * Fleet Arena — tournament domain types (client-side view models).
 *
 * These mirror the relevant columns of the `tournaments`, `tournament_entries`,
 * `tournament_rounds` and `tournament_matches` tables (see
 * supabase/migrations/20260721120500_tournaments.sql). Only the fields the UI
 * reads are typed here.
 */

export type TournamentStatus =
  | 'draft'
  | 'registration'
  | 'upcoming'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export type TournamentFormat =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'swiss';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  max_players: number;
  min_players: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  player_id: string;
  seed: number | null;
  final_rank: number | null;
  wins: number;
  losses: number;
  eliminated: boolean;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  name: string | null;
  status: TournamentStatus;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_id: string;
  bracket_position: number;
  player_one_id: string | null;
  player_two_id: string | null;
  winner_id: string | null;
  status: string;
}
