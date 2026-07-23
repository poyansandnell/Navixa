/**
 * Navixa — Socket.IO realtime subscriptions for the online-play flow.
 *
 * Two hooks (drop-in replacements for the old Supabase Realtime versions):
 *  - useMatchmakingRealtime: listens for `matchmaking:matched` on the caller's
 *    auto-joined `user:<id>` room while searching.
 *  - useMatchRealtime: subscribes to a match room (`match:subscribe`) and
 *    forwards `match:update` / `match:move` / `match:event` to handlers while a
 *    match is in progress.
 *
 * The `userId` argument on useMatchmakingRealtime is retained for call-site
 * compatibility but no longer used for room targeting — the socket server joins
 * the authenticated user's room automatically.
 */
import { useEffect, useRef } from 'react';

import {
  connectSocket,
  getSocket,
  subscribeToMatch,
  unsubscribeFromMatch,
} from '@/lib/socket';

const LOG = '[online.rt]';

/**
 * Subscribe while searching. Calls `onMatchFound(matchId)` when the server
 * emits `matchmaking:matched` to the caller's user room.
 */
export function useMatchmakingRealtime(
  _userId: string | null,
  enabled: boolean,
  onMatchFound: (matchId: string) => void,
): void {
  const cbRef = useRef(onMatchFound);
  cbRef.current = onMatchFound;

  useEffect(() => {
    if (!enabled) return;

    const socket = connectSocket();
    const handler = (payload: { matchId?: string }) => {
      console.log(`${LOG} matchmaking:matched`, payload?.matchId);
      if (payload?.matchId) cbRef.current(payload.matchId);
    };
    socket.on('matchmaking:matched', handler);

    return () => {
      socket.off('matchmaking:matched', handler);
    };
  }, [enabled]);
}

export interface MatchRealtimeHandlers {
  /** matches row changed (status, current turn, deadline). */
  onMatchRow?: (row: Record<string, unknown>) => void;
  /** A new move landed (any player). */
  onMove?: (row: Record<string, unknown>) => void;
  /** A new match_event landed (turn_started, forfeit, ...). */
  onEvent?: (row: Record<string, unknown>) => void;
}

/**
 * Subscribe to a single match while it is in progress. Handlers are held in a
 * ref so re-renders do not churn the subscription.
 */
export function useMatchRealtime(
  matchId: string | null,
  enabled: boolean,
  handlers: MatchRealtimeHandlers,
): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled || !matchId) return;

    const socket = getSocket();
    const onUpdate = (row: Record<string, unknown>) => {
      console.log(`${LOG} match:update`);
      ref.current.onMatchRow?.(row);
    };
    const onMove = (row: Record<string, unknown>) => {
      console.log(`${LOG} match:move`);
      ref.current.onMove?.(row);
    };
    const onEvent = (row: Record<string, unknown>) => {
      console.log(`${LOG} match:event`);
      ref.current.onEvent?.(row);
    };

    socket.on('match:update', onUpdate);
    socket.on('match:move', onMove);
    socket.on('match:event', onEvent);
    void subscribeToMatch(matchId);

    return () => {
      socket.off('match:update', onUpdate);
      socket.off('match:move', onMove);
      socket.off('match:event', onEvent);
      unsubscribeFromMatch(matchId);
    };
  }, [matchId, enabled]);
}
