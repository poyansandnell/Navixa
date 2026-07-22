/**
 * Shared layout math + cell visual model for the game boards.
 */
import { Dimensions } from 'react-native';

import { spacing } from '@/constants/theme';

/**
 * Compute the pixel size of one board cell so a `boardSize`x`boardSize` grid
 * fits within the available width. `outerPadding` accounts for screen padding
 * and any surrounding chrome; falls back to the current window width.
 */
export function computeCellSize(
  boardSize: number,
  availableWidth?: number,
  gutter = spacing.lg * 2,
): number {
  const width = availableWidth ?? Dimensions.get('window').width;
  const usable = Math.max(0, width - gutter);
  // Leave room for the label column (roughly one cell) on the main board.
  return Math.floor(usable / (boardSize + 1));
}

/** Column letters A.. */
export const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * A glyph/symbol for a cell state. Symbols (not color alone) encode meaning so
 * the board stays legible in colorblind mode.
 *   miss → · (dot)   hit → ✕   sunk → ✕ (bold, emphasized)   ship → ▩
 */
export type CellSymbol = 'none' | 'miss' | 'hit' | 'sunk' | 'ship';

export function symbolFor(kind: CellSymbol): string {
  switch (kind) {
    case 'miss':
      return '•';
    case 'hit':
      return '✕';
    case 'sunk':
      return '✕';
    case 'ship':
      return '▦';
    case 'none':
    default:
      return '';
  }
}
