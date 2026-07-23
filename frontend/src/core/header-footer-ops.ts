import type { TextRun, MarkType } from '../core/types';
import { createTextRun } from './document';

// ============================================================
// Token Context
// ============================================================

export interface TokenContext {
  pageNumber: number;
  totalPages: number;
}

const TOKEN_RESOLVERS: Record<string, (ctx: TokenContext) => string> = {
  '{pageNumber}': (ctx) => String(ctx.pageNumber),
  '{totalPages}': (ctx) => String(ctx.totalPages),
  '{date}': () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  },
  '{time}': () => new Date().toLocaleTimeString(),
};

// ============================================================
// insertTokenAtCursor
// ============================================================

/**
 * Insert a token string at the given character offset within a runs array.
 * Walks runs to find which run contains the offset, splits it, and inserts
 * a new TextRun with the token content and no marks.
 */
export function insertTokenAtCursor(
  runs: TextRun[],
  cursorOffset: number,
  token: string,
): TextRun[] {
  const tokenRun = createTextRun(token);

  if (runs.length === 0) {
    return [tokenRun];
  }

  const result: TextRun[] = [];
  let accumulated = 0;

  for (const run of runs) {
    const runStart = accumulated;
    const runEnd = runStart + run.content.length;

    if (cursorOffset <= runEnd && cursorOffset >= runStart) {
      const localOffset = cursorOffset - runStart;

      // Split this run at the cursor position
      const before = localOffset > 0
        ? { ...run, content: run.content.slice(0, localOffset) }
        : null;
      const after = localOffset < run.content.length
        ? { ...run, content: run.content.slice(localOffset) }
        : null;

      if (before) result.push(before);
      result.push(tokenRun);
      if (after) result.push(after);

      // Add remaining runs after this one
      const currentIndex = runs.indexOf(run);
      result.push(...runs.slice(currentIndex + 1));
      return result;
    }

    result.push(run);
    accumulated = runEnd;
  }

  // Offset beyond all runs — append at end
  result.push(tokenRun);
  return result;
}

// ============================================================
// toggleMarkOnRuns
// ============================================================

/**
 * Toggle a mark on a range [startOffset, endOffset) across runs.
 * If all runs in the range already have the mark, remove it.
 * Otherwise, add it.
 */
export function toggleMarkOnRuns(
  runs: TextRun[],
  startOffset: number,
  endOffset: number,
  mark: MarkType,
): TextRun[] {
  if (startOffset === endOffset || runs.length === 0) {
    return [...runs];
  }

  // First, split runs at boundaries to get clean segments
  const segments = splitRunsAtOffsets(runs, startOffset, endOffset);

  // Determine if we should add or remove the mark
  // Check if ALL segments within the range already have the mark
  const allHaveMark = segments
    .filter((seg) => seg._inRange)
    .every((seg) => seg.run.marks.includes(mark));

  const shouldRemove = allHaveMark;

  // Apply or remove the mark on in-range segments
  return segments.map((seg) => {
    if (!seg._inRange) return seg.run;

    const marks = shouldRemove
      ? seg.run.marks.filter((m: MarkType) => m !== mark)
      : seg.run.marks.includes(mark)
        ? seg.run.marks
        : [...seg.run.marks, mark];

    return { ...seg.run, marks };
  });
}

interface MarkedSegment {
  run: TextRun;
  _inRange: boolean;
}

/**
 * Split runs at two offset boundaries, tagging each segment as in-range or not.
 */
function splitRunsAtOffsets(
  runs: TextRun[],
  offset1: number,
  offset2: number,
): MarkedSegment[] {
  const lo = Math.min(offset1, offset2);
  const hi = Math.max(offset1, offset2);
  const result: MarkedSegment[] = [];
  let accumulated = 0;

  for (const run of runs) {
    const runStart = accumulated;
    const runEnd = runStart + run.content.length;

    if (runEnd <= lo || runStart >= hi) {
      // Entirely outside the range
      result.push({ run, _inRange: false });
    } else {
      // This run overlaps with the range — split it
      const localLo = Math.max(0, lo - runStart);
      const localHi = Math.min(run.content.length, hi - runStart);

      if (localLo > 0) {
        result.push({
          run: { ...run, content: run.content.slice(0, localLo) },
          _inRange: false,
        });
      }

      result.push({
        run: { ...run, content: run.content.slice(localLo, localHi) },
        _inRange: true,
      });

      if (localHi < run.content.length) {
        result.push({
          run: { ...run, content: run.content.slice(localHi) },
          _inRange: false,
        });
      }
    }

    accumulated = runEnd;
  }

  return result;
}

// ============================================================
// runsFromPlainText
// ============================================================

/**
 * Convert plain text to a single TextRun with no marks.
 * Returns empty array for empty/falsy input.
 */
export function runsFromPlainText(text: string): TextRun[] {
  if (!text) return [];
  return [createTextRun(text)];
}

// ============================================================
// resolveTokens
// ============================================================

/**
 * Replace known tokens ({pageNumber}, {totalPages}, {date}, {time})
 * with their resolved values. Unknown tokens are left as literal text.
 */
export function resolveTokens(text: string, context: TokenContext): string {
  return text.replace(/\{[^}]+\}/g, (match) => {
    const resolver = TOKEN_RESOLVERS[match];
    return resolver ? resolver(context) : match;
  });
}
