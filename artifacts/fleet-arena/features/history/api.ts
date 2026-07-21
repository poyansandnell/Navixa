/**
 * Data-access for match history & replay. Everything here reads only public,
 * post-finish data: matches (finished/abandoned), match_players (public after
 * finish), match_moves (public after finish). Private board layouts are never
 * loaded — the replay is reconstructed purely from the move log.
 */
import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/features/social/api';

export interface HistoryMatch {
  id: string;
  mode: string;
  status: string;
  boardSize: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  winnerId: string | null;
  /** The current user's seat/player row. */
  me: MatchPlayer;
  /** The opponent seat/player row (may be a bot with null player_id). */
  opponent: MatchPlayer;
  opponentProfile: ProfileRow | null;
}

export interface MatchPlayer {
  id: string;
  playerId: string | null;
  seat: number;
  result: string | null;
  ratingDelta: number | null;
  shotsFired: number;
  hits: number;
  shipsSunk: number;
  forfeited: boolean;
}

export interface MoveRow {
  moveNumber: number;
  playerId: string | null;
  x: number;
  y: number;
  isHit: boolean;
  sunkShip: string | null;
  createdAt: string;
}

const PROFILE_COLS =
  'id, username, display_name, avatar_url, country_code, xp, level, last_seen_at, created_at, is_bot';

function toPlayer(row: Record<string, unknown>): MatchPlayer {
  return {
    id: row.id as string,
    playerId: (row.player_id as string | null) ?? null,
    seat: row.seat as number,
    result: (row.result as string | null) ?? null,
    ratingDelta: (row.rating_delta as number | null) ?? null,
    shotsFired: (row.shots_fired as number) ?? 0,
    hits: (row.hits as number) ?? 0,
    shipsSunk: (row.ships_sunk as number) ?? 0,
    forfeited: Boolean(row.forfeited),
  };
}

/** List the current user's finished matches, newest first. */
export async function fetchMatchHistory(selfId: string): Promise<HistoryMatch[]> {
  // Match rows the user participated in that are finished/abandoned.
  const { data: myRows, error: myErr } = await supabase
    .from('match_players')
    .select('id, match_id, player_id, seat, result, rating_delta, shots_fired, hits, ships_sunk, forfeited')
    .eq('player_id', selfId);
  if (myErr) throw myErr;
  const mine = (myRows ?? []) as Record<string, unknown>[];
  const matchIds = Array.from(new Set(mine.map((r) => r.match_id as string)));
  if (matchIds.length === 0) return [];

  const { data: matchRows, error: mErr } = await supabase
    .from('matches')
    .select('id, mode, status, board_size, started_at, finished_at, created_at, winner_id')
    .in('id', matchIds)
    .in('status', ['finished', 'abandoned'])
    .order('finished_at', { ascending: false, nullsFirst: false });
  if (mErr) throw mErr;
  const matches = (matchRows ?? []) as Record<string, unknown>[];
  const finishedIds = matches.map((m) => m.id as string);
  if (finishedIds.length === 0) return [];

  // All player rows for those matches (public after finish).
  const { data: allPlayers, error: apErr } = await supabase
    .from('match_players')
    .select('id, match_id, player_id, seat, result, rating_delta, shots_fired, hits, ships_sunk, forfeited')
    .in('match_id', finishedIds);
  if (apErr) throw apErr;
  const playersByMatch = new Map<string, Record<string, unknown>[]>();
  for (const p of (allPlayers ?? []) as Record<string, unknown>[]) {
    const key = p.match_id as string;
    const list = playersByMatch.get(key) ?? [];
    list.push(p);
    playersByMatch.set(key, list);
  }

  // Opponent profiles.
  const oppIds = new Set<string>();
  for (const list of playersByMatch.values()) {
    for (const p of list) {
      const pid = p.player_id as string | null;
      if (pid && pid !== selfId) oppIds.add(pid);
    }
  }
  const profMap = new Map<string, ProfileRow>();
  if (oppIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .in('id', Array.from(oppIds));
    for (const p of (profs ?? []) as ProfileRow[]) profMap.set(p.id, p);
  }

  const out: HistoryMatch[] = [];
  for (const m of matches) {
    const matchId = m.id as string;
    const players = playersByMatch.get(matchId) ?? [];
    const meRow = players.find((p) => p.player_id === selfId);
    const oppRow = players.find((p) => p.id !== meRow?.id);
    if (!meRow) continue;
    const oppPid = (oppRow?.player_id as string | null) ?? null;
    out.push({
      id: matchId,
      mode: m.mode as string,
      status: m.status as string,
      boardSize: (m.board_size as number) ?? 10,
      startedAt: (m.started_at as string | null) ?? null,
      finishedAt: (m.finished_at as string | null) ?? null,
      createdAt: m.created_at as string,
      winnerId: (m.winner_id as string | null) ?? null,
      me: toPlayer(meRow),
      opponent: oppRow ? toPlayer(oppRow) : {
        id: '', playerId: null, seat: meRow.seat === 0 ? 1 : 0, result: null,
        ratingDelta: null, shotsFired: 0, hits: 0, shipsSunk: 0, forfeited: false,
      },
      opponentProfile: oppPid ? profMap.get(oppPid) ?? null : null,
    });
  }
  return out;
}

export interface MatchDetail {
  match: HistoryMatch;
  moves: MoveRow[];
}

/** Load a single finished match + its full ordered move log for replay. */
export async function fetchMatchDetail(matchId: string, selfId: string): Promise<MatchDetail | null> {
  const { data: m, error: mErr } = await supabase
    .from('matches')
    .select('id, mode, status, board_size, started_at, finished_at, created_at, winner_id')
    .eq('id', matchId)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!m) return null;

  const { data: players, error: pErr } = await supabase
    .from('match_players')
    .select('id, match_id, player_id, seat, result, rating_delta, shots_fired, hits, ships_sunk, forfeited')
    .eq('match_id', matchId);
  if (pErr) throw pErr;
  const plist = (players ?? []) as Record<string, unknown>[];
  const meRow = plist.find((p) => p.player_id === selfId) ?? plist[0];
  const oppRow = plist.find((p) => p.id !== meRow?.id);

  const oppPid = (oppRow?.player_id as string | null) ?? null;
  let opponentProfile: ProfileRow | null = null;
  if (oppPid) {
    const { data: prof } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', oppPid)
      .maybeSingle();
    opponentProfile = (prof as ProfileRow) ?? null;
  }

  const { data: moveRows, error: moveErr } = await supabase
    .from('match_moves')
    .select('move_number, player_id, target_x, target_y, is_hit, sunk_ship, created_at')
    .eq('match_id', matchId)
    .order('move_number', { ascending: true });
  if (moveErr) throw moveErr;

  const moves: MoveRow[] = ((moveRows ?? []) as Record<string, unknown>[]).map((r) => ({
    moveNumber: r.move_number as number,
    playerId: (r.player_id as string | null) ?? null,
    x: r.target_x as number,
    y: r.target_y as number,
    isHit: Boolean(r.is_hit),
    sunkShip: (r.sunk_ship as string | null) ?? null,
    createdAt: r.created_at as string,
  }));

  const match: HistoryMatch = {
    id: m.id as string,
    mode: m.mode as string,
    status: m.status as string,
    boardSize: (m.board_size as number) ?? 10,
    startedAt: (m.started_at as string | null) ?? null,
    finishedAt: (m.finished_at as string | null) ?? null,
    createdAt: m.created_at as string,
    winnerId: (m.winner_id as string | null) ?? null,
    me: meRow ? toPlayer(meRow) : {
      id: '', playerId: selfId, seat: 0, result: null, ratingDelta: null,
      shotsFired: 0, hits: 0, shipsSunk: 0, forfeited: false,
    },
    opponent: oppRow ? toPlayer(oppRow) : {
      id: '', playerId: null, seat: 1, result: null, ratingDelta: null,
      shotsFired: 0, hits: 0, shipsSunk: 0, forfeited: false,
    },
    opponentProfile,
  };

  return { match, moves };
}

/** Compute a match's wall-clock duration in ms (started→finished). */
export function matchDurationMs(match: HistoryMatch): number | null {
  if (!match.startedAt || !match.finishedAt) return null;
  const start = new Date(match.startedAt).getTime();
  const end = new Date(match.finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

/** Result of the match from the current user's perspective. */
export function myResult(match: HistoryMatch): 'win' | 'loss' | 'draw' {
  if (match.me.result === 'win') return 'win';
  if (match.me.result === 'loss') return 'loss';
  if (match.me.result === 'draw') return 'draw';
  // Fall back to winner_id.
  if (match.winnerId && match.me.playerId) {
    return match.winnerId === match.me.playerId ? 'win' : 'loss';
  }
  return 'draw';
}

/** End reason label key derived from status + forfeit flags. */
export function endReasonKey(match: HistoryMatch): string {
  if (match.status === 'abandoned') return 'abandoned';
  if (match.me.forfeited || match.opponent.forfeited) return 'resign';
  return 'complete';
}
