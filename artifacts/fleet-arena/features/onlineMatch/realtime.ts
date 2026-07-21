/**
 * Fleet Arena — Supabase Realtime subscriptions for the online-play flow.
 *
 * Two hooks:
 *  - useMatchmakingRealtime: watches the caller's matchmaking_queue row and the
 *    matches table for a "match found" signal while searching.
 *  - useMatchRealtime: watches a single match's row (status / turn changes),
 *    match_moves (opponent shots) and match_events (turn events, reactions if
 *    ever server-writable) while a match is in progress.
 *
 * postgres_changes only fires when Realtime is enabled for the table on the
 * project; the code is defensive and also relies on edge-function responses so
 * it degrades gracefully if a change event is missed.
 */
import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

const LOG = '[online.rt]';

/**
 * Subscribe while searching. Calls `onMatchFound(matchId)` when either the
 * player's queue row transitions to `matched` (with matched_match_id) or a
 * match row appears that references this player. Returns nothing; cleans up on
 * unmount / dependency change.
 */
export function useMatchmakingRealtime(
  userId: string | null,
  enabled: boolean,
  onMatchFound: (matchId: string) => void,
): void {
  const cbRef = useRef(onMatchFound);
  cbRef.current = onMatchFound;

  useEffect(() => {
    if (!enabled || !userId) return;

    const channel: RealtimeChannel = supabase
      .channel(`mm-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_queue',
          filter: `player_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as
            | { status?: string; matched_match_id?: string | null }
            | undefined;
          console.log(`${LOG} queue change`, row?.status);
          if (row?.status === 'matched' && row.matched_match_id) {
            cbRef.current(row.matched_match_id);
          }
        },
      )
      .subscribe((status) => {
        console.log(`${LOG} mm channel`, status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, enabled]);
}

export interface MatchRealtimeHandlers {
  /** matches row changed (status, current_turn_player_id, turn_deadline). */
  onMatchRow?: (row: Record<string, unknown>) => void;
  /** A new move landed (any player). */
  onMove?: (row: Record<string, unknown>) => void;
  /** A new match_event landed (turn_started, reaction, forfeit, ...). */
  onEvent?: (row: Record<string, unknown>) => void;
}

/**
 * Subscribe to a single match while it is in progress. All handlers are held
 * in refs so re-renders do not churn the channel.
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

    const channel: RealtimeChannel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          console.log(`${LOG} match row change`);
          ref.current.onMatchRow?.(payload.new as Record<string, unknown>);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_moves', filter: `match_id=eq.${matchId}` },
        (payload) => {
          console.log(`${LOG} move insert`);
          ref.current.onMove?.(payload.new as Record<string, unknown>);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        (payload) => {
          console.log(`${LOG} event insert`);
          ref.current.onEvent?.(payload.new as Record<string, unknown>);
        },
      )
      .subscribe((status) => {
        console.log(`${LOG} match channel`, status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, enabled]);
}
