/**
 * Zero-AI-cost analytics: aggregates the eval + speech data the app already
 * stores on every interview turn into radar/heatmap/trend datasets.
 */

export interface EvalTurnRow {
  interview_id: string;
  eval: { score: number; note?: string; tags?: string[] } | null;
  speech_metrics: {
    wpm?: number;
    fillers?: number;
    hedges?: number;
    long_pauses?: number;
    clarity?: number | null;
  } | null;
  created_at: string;
}

export interface InterviewMeta {
  id: string;
  started_at: string;
  role_track: string;
}

// ---------- Skill radar ----------
export interface SkillStat {
  skill: string;
  /** 0-100 (avg eval score × 10) */
  score: number;
  samples: number;
}

export function aggregateSkills(rows: EvalTurnRow[], topN = 8): SkillStat[] {
  const byTag = new Map<string, { total: number; n: number }>();
  for (const row of rows) {
    if (!row.eval || typeof row.eval.score !== "number") continue;
    for (const raw of row.eval.tags ?? []) {
      const tag = raw.trim().toLowerCase();
      if (!tag) continue;
      const cur = byTag.get(tag) ?? { total: 0, n: 0 };
      cur.total += row.eval.score;
      cur.n += 1;
      byTag.set(tag, cur);
    }
  }
  return [...byTag.entries()]
    .map(([skill, { total, n }]) => ({
      skill,
      score: Math.round((total / n) * 10),
      samples: n,
    }))
    .sort((a, b) => b.samples - a.samples) // most-practiced first
    .slice(0, topN);
}

// ---------- Weakness heatmap (tags × recent interviews) ----------
export interface HeatmapData {
  /** newest last */
  interviews: { id: string; label: string }[];
  rows: {
    skill: string;
    /** avg 0-10 score per interview, null = not touched */
    cells: (number | null)[];
    avg: number;
  }[];
}

export function buildHeatmap(
  rows: EvalTurnRow[],
  interviews: InterviewMeta[],
  maxCols = 6,
  maxRows = 8
): HeatmapData {
  const recent = [...interviews]
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
    .slice(-maxCols);
  const colIdx = new Map(recent.map((iv, i) => [iv.id, i]));

  const byTag = new Map<string, { sums: number[]; counts: number[] }>();
  for (const row of rows) {
    const col = colIdx.get(row.interview_id);
    if (col === undefined || !row.eval) continue;
    for (const raw of row.eval.tags ?? []) {
      const tag = raw.trim().toLowerCase();
      if (!tag) continue;
      let entry = byTag.get(tag);
      if (!entry) {
        entry = {
          sums: new Array(recent.length).fill(0),
          counts: new Array(recent.length).fill(0),
        };
        byTag.set(tag, entry);
      }
      entry.sums[col] += row.eval.score;
      entry.counts[col] += 1;
    }
  }

  const heatRows = [...byTag.entries()]
    .map(([skill, { sums, counts }]) => {
      const cells = sums.map((s, i) =>
        counts[i] ? Math.round((s / counts[i]) * 10) / 10 : null
      );
      const totalN = counts.reduce((a, b) => a + b, 0);
      const totalS = sums.reduce((a, b) => a + b, 0);
      return {
        skill,
        cells,
        avg: totalN ? Math.round((totalS / totalN) * 10) / 10 : 0,
        samples: totalN,
      };
    })
    .filter((r) => r.samples >= 1)
    .sort((a, b) => a.avg - b.avg) // weakest first
    .slice(0, maxRows)
    .map(({ skill, cells, avg }) => ({ skill, cells, avg }));

  return {
    interviews: recent.map((iv, i) => ({
      id: iv.id,
      label: `#${i + 1}`,
    })),
    rows: heatRows,
  };
}

// ---------- Delivery trends ----------
export interface DeliveryPoint {
  label: string; // date
  wpm: number | null;
  fillers: number;
  hedges: number;
  pauses: number;
  /** 0-100 avg recognition confidence, null when never measured. */
  clarity: number | null;
}

export function aggregateDelivery(
  rows: EvalTurnRow[],
  interviews: InterviewMeta[]
): { points: DeliveryPoint[]; insight: string | null } {
  const ordered = [...interviews].sort(
    (a, b) => Date.parse(a.started_at) - Date.parse(b.started_at)
  );
  const byInterview = new Map<string, EvalTurnRow[]>();
  for (const row of rows) {
    if (!row.speech_metrics) continue;
    const list = byInterview.get(row.interview_id) ?? [];
    list.push(row);
    byInterview.set(row.interview_id, list);
  }

  const points: DeliveryPoint[] = [];
  for (const iv of ordered) {
    const turns = byInterview.get(iv.id);
    if (!turns || turns.length === 0) continue;
    const wpms = turns
      .map((t) => t.speech_metrics?.wpm)
      .filter((w): w is number => typeof w === "number" && w > 0);
    const clarities = turns
      .map((t) => t.speech_metrics?.clarity)
      .filter((c): c is number => typeof c === "number" && c > 0);
    points.push({
      label: new Date(iv.started_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      wpm: wpms.length
        ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length)
        : null,
      fillers: turns.reduce(
        (a, t) => a + (t.speech_metrics?.fillers ?? 0),
        0
      ),
      hedges: turns.reduce((a, t) => a + (t.speech_metrics?.hedges ?? 0), 0),
      pauses: turns.reduce(
        (a, t) => a + (t.speech_metrics?.long_pauses ?? 0),
        0
      ),
      clarity: clarities.length
        ? Math.round(clarities.reduce((a, b) => a + b, 0) / clarities.length)
        : null,
    });
  }

  // Rule-based insight: compare first vs last interview with voice data.
  let insight: string | null = null;
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.fillers > 0 && last.fillers < first.fillers) {
      const drop = Math.round(
        ((first.fillers - last.fillers) / first.fillers) * 100
      );
      if (drop >= 15) insight = `Filler words down ${drop}% since your first voice interview — keep it up.`;
    }
    if (!insight && last.fillers > first.fillers && last.fillers >= 5) {
      insight = `Filler words crept up lately — try pausing silently instead of saying "um".`;
    }
    if (!insight && last.wpm && (last.wpm > 180 || last.wpm < 100)) {
      insight =
        last.wpm > 180
          ? `You're averaging ${last.wpm} wpm — a touch fast; interviewers absorb ~130-160 best.`
          : `You're averaging ${last.wpm} wpm — slightly slow; aim for a conversational 130-160.`;
    }
    if (!insight && last.hedges >= 5) {
      insight = `You hedged ${last.hedges} times last round ("I think", "maybe") — state your answer, then caveat if you must.`;
    }
    if (!insight && last.clarity !== null && last.clarity < 70) {
      insight = `Speech clarity was ${last.clarity}% last round — slow down slightly and over-enunciate technical terms.`;
    }
  }

  return { points, insight };
}
