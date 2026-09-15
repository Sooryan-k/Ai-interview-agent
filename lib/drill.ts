/**
 * Daily Drill: one question per selected technology per day.
 *
 * The rules that make it stable are all here, as pure functions, so they can
 * be tested without a database:
 *  - which calendar day it is *for this user*, not for the server;
 *  - what changes when their stack selection moves mid-day.
 */

/** A drill row as stored. */
export interface DrillRow {
  stack_id: string;
  position: number;
  answered_at?: string | null;
  result?: "got_it" | "missed" | null;
}

/* ------------------------------------------------------------------ *
 * The day boundary
 * ------------------------------------------------------------------ */

/**
 * The calendar date in a given IANA timezone, as YYYY-MM-DD.
 *
 * `en-CA` is used because it formats as ISO (2026-09-15) — the alternative is
 * assembling parts by hand, which gets the padding wrong often enough to be
 * worth avoiding.
 *
 * An unknown or missing zone falls back to UTC rather than throwing: a bad
 * header should cost the user an accurate day boundary, not the whole drill.
 */
export function localDay(timeZone: string | null | undefined, now: Date = new Date()): string {
  if (!timeZone) return utcDate(now);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return utcDate(now);
  }
}

function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whether a string is a plausible IANA zone this runtime knows about. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Reconciling the day's set against the current stack selection
 * ------------------------------------------------------------------ */

export interface ReconcilePlan {
  /** Stacks needing a question generated for today. */
  toAdd: string[];
  /** Rows to delete — unanswered questions for stacks no longer selected. */
  toRemove: string[];
  /** Rows that stay exactly as they are. */
  keep: string[];
  /** Next free position, so additions land after what's already on screen. */
  nextPosition: number;
}

/**
 * Works out the minimum change needed to bring today's stored set in line
 * with the user's current stack selection.
 *
 * Two deliberate choices:
 *  - An **answered** question for a removed stack is KEPT. They did the work;
 *    deleting it would silently lower the day's score and make the progress
 *    counter go backwards. Only unanswered orphans are dropped.
 *  - Existing rows never move. Additions take positions after the current
 *    maximum, so adding a technology at lunchtime doesn't reshuffle the
 *    questions already on screen.
 */
export function reconcileDrillSet(
  existing: DrillRow[],
  selectedStackIds: string[]
): ReconcilePlan {
  const selected = new Set(selectedStackIds);
  const have = new Set(existing.map((r) => r.stack_id));

  const toRemove: string[] = [];
  const keep: string[] = [];
  for (const row of existing) {
    const stillSelected = selected.has(row.stack_id);
    const answered = Boolean(row.answered_at);
    if (stillSelected || answered) keep.push(row.stack_id);
    else toRemove.push(row.stack_id);
  }

  // Preserve the user's stack order for anything new.
  const toAdd = selectedStackIds.filter((id) => !have.has(id));

  const nextPosition =
    existing.length > 0 ? Math.max(...existing.map((r) => r.position)) + 1 : 0;

  return { toAdd, toRemove, keep, nextPosition };
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export interface DrillProgress {
  total: number;
  answered: number;
  correct: number;
  complete: boolean;
  /** Percentage of answered questions got right, or null before any answer. */
  scorePct: number | null;
}

export function drillProgress(rows: DrillRow[]): DrillProgress {
  const total = rows.length;
  const answeredRows = rows.filter((r) => Boolean(r.answered_at));
  const correct = answeredRows.filter((r) => r.result === "got_it").length;
  return {
    total,
    answered: answeredRows.length,
    correct,
    complete: total > 0 && answeredRows.length === total,
    scorePct:
      answeredRows.length > 0
        ? Math.round((correct / answeredRows.length) * 100)
        : null,
  };
}
