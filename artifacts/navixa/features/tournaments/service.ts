/**
 * Navixa — tournament data access via the api-server.
 *
 *   GET  /api/tournaments             → { tournaments }
 *   GET  /api/tournaments/:id         → { tournament, entries, rounds, matches }
 *   POST /api/tournaments/:id/register → { ok, alreadyRegistered }
 *
 * The server returns camelCase drizzle rows which we normalise into the app's
 * snake_case view models. The detail endpoint returns entries/rounds/matches
 * together, so `fetchRounds`/`fetchMatches`/`fetchEntries` share a short-lived
 * per-tournament cache to avoid refetching on a single screen load.
 *
 * Contract gap: there is no unregister/withdraw endpoint, so
 * `unregisterFromTournament` is a no-op that reports failure.
 */
import { apiFetch, ApiError } from '@/lib/api';
import type {
  Tournament,
  TournamentEntry,
  TournamentFormat,
  TournamentMatch,
  TournamentRound,
  TournamentStatus,
} from './types';

// --- server row shapes -------------------------------------------------------

interface ServerTournament {
  id: string;
  name: string;
  description?: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  maxPlayers?: number | null;
  minPlayers?: number | null;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

interface ServerEntry {
  id: string;
  tournamentId: string;
  playerId: string;
  seed?: number | null;
  finalRank?: number | null;
  wins?: number | null;
  losses?: number | null;
  eliminated?: boolean | null;
}

interface ServerRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  name?: string | null;
  status: TournamentStatus;
}

interface ServerMatch {
  id: string;
  tournamentId: string;
  roundId: string;
  bracketPosition: number;
  playerOneId?: string | null;
  playerTwoId?: string | null;
  winnerId?: string | null;
  status: string;
}

interface ServerDetail {
  tournament: ServerTournament;
  entries: ServerEntry[];
  rounds: ServerRound[];
  matches: ServerMatch[];
}

function toTournament(t: ServerTournament): Tournament {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    format: t.format,
    status: t.status,
    max_players: t.maxPlayers ?? 16,
    min_players: t.minPlayers ?? 2,
    registration_opens_at: t.registrationOpensAt ?? null,
    registration_closes_at: t.registrationClosesAt ?? null,
    starts_at: t.startsAt ?? null,
    ends_at: t.endsAt ?? null,
  };
}

function toEntry(e: ServerEntry): TournamentEntry {
  return {
    id: e.id,
    tournament_id: e.tournamentId,
    player_id: e.playerId,
    seed: e.seed ?? null,
    final_rank: e.finalRank ?? null,
    wins: e.wins ?? 0,
    losses: e.losses ?? 0,
    eliminated: Boolean(e.eliminated),
  };
}

function toRound(r: ServerRound): TournamentRound {
  return {
    id: r.id,
    tournament_id: r.tournamentId,
    round_number: r.roundNumber,
    name: r.name ?? null,
    status: r.status,
  };
}

function toMatch(m: ServerMatch): TournamentMatch {
  return {
    id: m.id,
    tournament_id: m.tournamentId,
    round_id: m.roundId,
    bracket_position: m.bracketPosition,
    player_one_id: m.playerOneId ?? null,
    player_two_id: m.playerTwoId ?? null,
    winner_id: m.winnerId ?? null,
    status: m.status,
  };
}

// --- short-lived detail cache ------------------------------------------------

const DETAIL_TTL_MS = 3000;
const detailCache = new Map<string, { at: number; promise: Promise<ServerDetail> }>();

async function getDetail(tournamentId: string): Promise<ServerDetail> {
  const now = Date.now();
  const cached = detailCache.get(tournamentId);
  if (cached && now - cached.at < DETAIL_TTL_MS) return cached.promise;
  const promise = apiFetch<ServerDetail>(`/tournaments/${tournamentId}`);
  detailCache.set(tournamentId, { at: now, promise });
  try {
    return await promise;
  } catch (err) {
    detailCache.delete(tournamentId);
    throw err;
  }
}

/** Fetch visible tournaments (drafts excluded) ordered by soonest start first. */
export async function fetchTournaments(): Promise<Tournament[]> {
  const res = await apiFetch<{ tournaments: ServerTournament[] }>('/tournaments');
  return res.tournaments
    .filter((t) => t.status !== 'draft')
    .map(toTournament)
    .sort((a, b) => {
      if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at);
      if (a.starts_at) return -1;
      if (b.starts_at) return 1;
      return 0;
    });
}

/** Fetch all entries for a set of tournaments (used for counts + my status). */
export async function fetchEntries(tournamentIds: string[]): Promise<TournamentEntry[]> {
  if (tournamentIds.length === 0) return [];
  const details = await Promise.all(
    tournamentIds.map((id) => getDetail(id).catch(() => null)),
  );
  const out: TournamentEntry[] = [];
  for (const d of details) {
    if (d) for (const e of d.entries) out.push(toEntry(e));
  }
  return out;
}

/** Rounds for one tournament, ordered by round number. */
export async function fetchRounds(tournamentId: string): Promise<TournamentRound[]> {
  const d = await getDetail(tournamentId);
  return d.rounds.map(toRound);
}

/** Bracket matches for one tournament, ordered by bracket position. */
export async function fetchMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const d = await getDetail(tournamentId);
  return d.matches.map(toMatch);
}

/** Fetch display names for a set of player ids (for bracket rendering). */
export async function fetchPlayerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const results = await Promise.all(
    unique.map((id) =>
      apiFetch<{ profile: { username?: string | null; displayName?: string | null } }>(
        `/profile/${id}`,
      )
        .then((r) => [id, r.profile] as const)
        .catch(() => [id, null] as const),
    ),
  );
  for (const [id, profile] of results) {
    map.set(id, profile?.displayName ?? profile?.username ?? id.slice(0, 6));
  }
  return map;
}

export interface RegisterResult {
  ok: boolean;
  reason?: 'full' | 'error';
}

/** Register the current user for a tournament (server-authoritative capacity). */
export async function registerForTournament(
  tournamentId: string,
  _playerId: string,
  _maxPlayers: number,
): Promise<RegisterResult> {
  try {
    await apiFetch(`/tournaments/${tournamentId}/register`, { method: 'POST', body: {} });
    detailCache.delete(tournamentId);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && /full/i.test(err.message)) {
      return { ok: false, reason: 'full' };
    }
    return { ok: false, reason: 'error' };
  }
}

/**
 * Withdraw the current user from a tournament.
 *
 * Contract gap: the api-server exposes no unregister/withdraw endpoint, so this
 * always reports failure. Kept for signature compatibility with callers.
 */
export async function unregisterFromTournament(
  _tournamentId: string,
  _playerId: string,
): Promise<boolean> {
  return false;
}
