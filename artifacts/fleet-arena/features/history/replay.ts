/**
 * Replay driver for finished matches.
 *
 * The server hides private board layouts, so a replay is reconstructed purely
 * from the public move log (match_moves). Each move is a shot fired *by* a
 * player *at* the opponent's board. We therefore build two grids of PublicCell
 * (miss/hit/sunk/unknown):
 *   - `opponentGrid`  = cells the viewer fired at the opponent
 *   - `ownGrid`       = cells the opponent fired at the viewer
 *
 * The driver exposes a cursor over the moves with prev/next/jump plus an
 * auto-play loop with adjustable speed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PublicCell } from '@/lib/engine';
import type { MoveRow } from './api';

export interface ReplayFrame {
  /** Number of moves applied (0..moves.length). */
  step: number;
  /** Viewer's fire grid (shots the viewer took at the opponent). */
  opponentGrid: PublicCell[][];
  /** Opponent's fire grid (shots the opponent took at the viewer). */
  ownGrid: PublicCell[][];
  /** The move applied to reach this frame (null at step 0). */
  lastMove: MoveRow | null;
  /** Whether the last move was fired by the viewer. */
  lastByViewer: boolean;
}

function emptyGrid(size: number): PublicCell[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 'unknown' as PublicCell));
}

/**
 * Build the full frame at a given step (pure). Applies moves [0, step) in order.
 * `viewerId` identifies which shots go onto the opponent grid vs. the own grid.
 * For bot matches the viewer's player_id matches; the opponent's moves have a
 * different (or null) player_id.
 */
export function frameAtStep(
  moves: MoveRow[],
  step: number,
  size: number,
  viewerId: string | null,
): ReplayFrame {
  const opponentGrid = emptyGrid(size);
  const ownGrid = emptyGrid(size);
  const clamped = Math.max(0, Math.min(step, moves.length));

  let lastMove: MoveRow | null = null;
  let lastByViewer = false;

  for (let i = 0; i < clamped; i++) {
    const mv = moves[i];
    const byViewer = viewerId != null && mv.playerId === viewerId;
    const grid = byViewer ? opponentGrid : ownGrid;
    if (mv.y >= 0 && mv.y < size && mv.x >= 0 && mv.x < size) {
      grid[mv.y][mv.x] = mv.sunkShip ? 'sunk' : mv.isHit ? 'hit' : 'miss';
    }
    lastMove = mv;
    lastByViewer = byViewer;
  }

  return { step: clamped, opponentGrid, ownGrid, lastMove, lastByViewer };
}

export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

const BASE_INTERVAL_MS = 900;

export interface UseReplayResult {
  frame: ReplayFrame;
  step: number;
  total: number;
  playing: boolean;
  speed: ReplaySpeed;
  atStart: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  setSpeed: (s: ReplaySpeed) => void;
}

/** Stateful replay controller hook. */
export function useReplay(
  moves: MoveRow[],
  size: number,
  viewerId: string | null,
): UseReplayResult {
  const total = moves.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frame = useMemo(
    () => frameAtStep(moves, step, size, viewerId),
    [moves, step, size, viewerId],
  );

  const atStart = step <= 0;
  const atEnd = step >= total;

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const next = useCallback(() => {
    setStep((s) => Math.min(total, s + 1));
  }, [total]);
  const prev = useCallback(() => {
    setPlaying(false);
    setStep((s) => Math.max(0, s - 1));
  }, []);
  const jumpToStart = useCallback(() => {
    setPlaying(false);
    setStep(0);
  }, []);
  const jumpToEnd = useCallback(() => {
    setPlaying(false);
    setStep(total);
  }, [total]);
  const play = useCallback(() => {
    if (total === 0) return;
    setStep((s) => (s >= total ? 0 : s));
    setPlaying(true);
  }, [total]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && total > 0) {
        setStep((s) => (s >= total ? 0 : s));
        return true;
      }
      return false;
    });
  }, [total]);

  // Auto-play loop.
  useEffect(() => {
    if (!playing) {
      clearTimer();
      return;
    }
    if (step >= total) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => {
      setStep((s) => Math.min(total, s + 1));
    }, BASE_INTERVAL_MS / speed);
    return clearTimer;
  }, [playing, step, total, speed, clearTimer]);

  return {
    frame,
    step,
    total,
    playing,
    speed,
    atStart,
    atEnd,
    play,
    pause,
    toggle,
    next,
    prev,
    jumpToStart,
    jumpToEnd,
    setSpeed,
  };
}
