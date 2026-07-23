/**
 * Data-access for match history & replay via the api-server.
 *
 *   GET /api/history            → { matches: [{ ...match, me, opponent, opponentProfile }] }
 *   GET /api/history/:matchId   → { match, players, moves, profiles }
 *
 * The server returns camelCase drizzle rows; we normalise them into the app's
 * view models here. Only public post-finish data is exposed — replays are
 * rebuilt from the move log, never from private board layouts.
 */
import { apiFetch } from '@/lib/api';
import { toProfileRow, type ServerProfile } from '@/lib/normalize';
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

/** Server match row (camelCase). */
interface ServerMatch {
  id: string;
  mode: string;
  status: string;
  boardSize?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  winnerId?: string | null;
}

interface ServerMatchPlayer {
  id: string;
  playerId?: string | null;
  seat: number;
  result?: string | null;
  ratingDelta?: number | null;
  shotsFired?: number | null;
  hits?: number | null;
  shipsSunk?: number | null;
  forfeited?: boolean | null;
}

interface ServerMove {
  moveNumber: number;
  playerId?: string | null;
  targetX: number;
  targetY: number;
  isHit?: boolean | null;
  sunkShip?: string | null;
  createdAt: string;
}

function toPlayer(row: ServerMatchPlayer | null | undefined, fallbackSeat = 1): MatchPlayer {
  if (!row) {
    return {
      id: '',
      playerId: null,
      seat: fallbackSeat,
      result: null,
      ratingDelta: null,
      shotsFired: 0,
      hits: 0,
      shipsSunk: 0,
      forfeited: false,
    };
  }
  return {
    id: row.id,
    playerId: row.playerId ?? null,
    seat: row.seat,
    result: row.result ?? null,
    ratingDelta: row.ratingDelta ?? null,
    shotsFired: row.shotsFired ?? 0,
    hits: row.hits ?? 0,
    shipsSunk: row.shipsSunk ?? 0,
    forfeited: Boolean(row.forfeited),
  };
}

function toHistoryMatch(
  m: ServerMatch,
  me: ServerMatchPlayer | null | undefined,
  opponent: ServerMatchPlayer | null | undefined,
  opponentProfile: ServerProfile | null | undefined,
): HistoryMatch {
  const meSeat = me?.seat ?? 0;
  return {
    id: m.id,
    mode: m.mode,
    status: m.status,
    boardSize: m.boardSize ?? 10,
    startedAt: m.startedAt ?? null,
    finishedAt: m.finishedAt ?? null,
    createdAt: m.createdAt ?? new Date(0).toISOString(),
    winnerId: m.winnerId ?? null,
    me: toPlayer(me, meSeat),
    opponent: toPlayer(opponent, meSeat === 0 ? 1 : 0),
    opponentProfile: toProfileRow(opponentProfile),
  };
}

interface HistoryListEntry extends ServerMatch {
  me: ServerMatchPlayer | null;
  opponent: ServerMatchPlayer | null;
  opponentProfile: ServerProfile | null;
}

/** List the current user's finished matches, newest first. */
export async function fetchMatchHistory(_selfId: string): Promise<HistoryMatch[]> {
  const res = await apiFetch<{ matches: HistoryListEntry[] }>('/history');
  return res.matches.map((m) =>
    toHistoryMatch(m, m.me, m.opponent, m.opponentProfile),
  );
}

export interface MatchDetail {
  match: HistoryMatch;
  moves: MoveRow[];
}

/** Load a single finished match + its full ordered move log for replay. */
export async function fetchMatchDetail(
  matchId: string,
  selfId: string,
): Promise<MatchDetail | null> {
  let res: {
    match: ServerMatch;
    players: ServerMatchPlayer[];
    moves: ServerMove[];
    profiles: ServerProfile[];
  };
  try {
    res = await apiFetch(`/history/${matchId}`);
  } catch {
    return null;
  }

  const players = res.players ?? [];
  const me = players.find((p) => p.playerId === selfId) ?? players[0] ?? null;
  const opponent = players.find((p) => p.id !== me?.id) ?? null;
  const oppProfile = opponent?.playerId
    ? res.profiles.find((p) => p.id === opponent.playerId) ?? null
    : null;

  const moves: MoveRow[] = (res.moves ?? []).map((r) => ({
    moveNumber: r.moveNumber,
    playerId: r.playerId ?? null,
    x: r.targetX,
    y: r.targetY,
    isHit: Boolean(r.isHit),
    sunkShip: r.sunkShip ?? null,
    createdAt: r.createdAt,
  }));

  return {
    match: toHistoryMatch(res.match, me, opponent, oppProfile),
    moves,
  };
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
