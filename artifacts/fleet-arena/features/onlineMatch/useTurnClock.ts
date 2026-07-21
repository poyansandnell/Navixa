/**
 * Fleet Arena — drift-corrected turn-clock countdown.
 *
 * Given the match `turn_deadline` (ISO string from the matches row / clock
 * block) and a `clockOffsetMs` (serverNow - deviceNow, measured on reconnect),
 * returns the remaining milliseconds on the current turn, ticking every
 * 250ms. Using the server offset means the countdown does not drift with an
 * inaccurate device clock.
 */
import { useEffect, useState } from 'react';

export function useTurnClock(
  turnDeadline: string | null | undefined,
  clockOffsetMs: number,
  active: boolean,
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!turnDeadline || !active) {
      setRemaining(null);
      return;
    }
    const deadlineMs = Date.parse(turnDeadline);
    if (!Number.isFinite(deadlineMs)) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const serverNow = Date.now() + clockOffsetMs;
      setRemaining(Math.max(0, deadlineMs - serverNow));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [turnDeadline, clockOffsetMs, active]);

  return remaining;
}

/** Format ms as M:SS for the clock UI. */
export function formatClock(ms: number | null): string {
  if (ms == null) return '—';
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
