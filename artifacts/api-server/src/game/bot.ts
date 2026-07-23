/**
 * Server-driven bot: fleet generation + scheduled bot moves.
 *
 * Clients never drive bot turns. After a human move in a bot match, the route
 * handler schedules a bot move with a small delay. The bot only sees the public
 * projection (projectPublicState) — never the human's unsunk ships.
 */
import { eq, and } from "drizzle-orm";
import {
  autoPlace,
  createBot,
  createRng,
  projectPublicState,
  DEFAULT_SHIPS,
  type BotDifficulty,
} from "@workspace/game-engine";
import { db, privateGameStatesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { buildMatchState, seatToPlayerId, type MatchRow } from "./helpers";
import { loadMatch, loadPrivateStates, applyShot } from "./service";

/** Deterministic 32-bit hash of a string (FNV-1a). */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generate + persist a bot's secret fleet (seat 1, player_id null). */
export async function ensureBotFleet(
  match: MatchRow,
  seat: number,
): Promise<void> {
  const rng = createRng(seedFromString(match.id));
  const fleet = autoPlace(
    { boardSize: match.boardSize, ships: DEFAULT_SHIPS, allowTouching: true },
    rng,
  );
  await db.insert(privateGameStatesTable).values({
    matchId: match.id,
    playerId: null,
    seat,
    isBot: true,
    board: fleet as never,
    shotsReceived: [],
    fleetSubmitted: true,
  });
}

const BOT_MOVE_DELAY_MS = Number(process.env.BOT_MOVE_DELAY_MS ?? 900);

/** Schedule a bot move after a short delay (fire-and-forget). */
export function scheduleBotMove(matchId: string): void {
  setTimeout(() => {
    runBotTurn(matchId).catch((err) => {
      logger.error({ err, matchId }, "bot turn failed");
    });
  }, BOT_MOVE_DELAY_MS);
}

/**
 * Execute a single bot turn if it is the bot's turn and the match is active.
 *
 * The bot's target coordinate is decided from a read-only snapshot, but the shot
 * is applied through applyShot() which re-locks the match row and re-validates
 * turn state inside a transaction. If a human shot committed in the interim (so
 * it is no longer the bot's turn), applyShot throws NOT_YOUR_TURN and we simply
 * abort this bot turn — the human shot already scheduled the next one.
 */
export async function runBotTurn(matchId: string): Promise<void> {
  const { match, players } = await loadMatch(matchId);
  if (match.mode !== "bot" || match.status !== "active") return;

  const botSeat = players.find((p) => p.isBot);
  if (!botSeat) return;

  const privates = await loadPrivateStates(matchId);
  const state = buildMatchState(match, players, privates);
  if (state.winner !== null) return;
  if (state.turn !== seatToPlayerId(botSeat.seat)) return;

  const difficulty = (botSeat.botDifficulty ?? "normal") as BotDifficulty;
  const bot = createBot(difficulty);
  const rng = createRng(
    (seedFromString(match.id) ^ (state.moveCount * 2654435761)) >>> 0,
  );
  const view = projectPublicState(state, seatToPlayerId(botSeat.seat));
  const coord = bot(view, rng);

  try {
    await applyShot({
      matchId,
      shooterSeat: botSeat.seat,
      x: coord.x,
      y: coord.y,
      idempotencyKey: `bot-${matchId}-${state.moveCount}`,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    // A human shot raced ahead of us; abort quietly. Other errors bubble up.
    if (code === "NOT_YOUR_TURN" || code === "MATCH_ALREADY_OVER" || code === "WRONG_MATCH_STATE") {
      return;
    }
    throw err;
  }
}
