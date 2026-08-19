/**
 * Zero-AI-cost delivery analysis. Pure functions over the answer text and the
 * Web Speech API's own recognition confidence — no model call, no quota.
 *
 * Two signals beyond filler words:
 *  - HEDGING: weak-commitment language ("I think maybe...", "I'm not sure but").
 *    Interviewers read this as low confidence even when the content is right,
 *    and it sinks more answers than "um" does.
 *  - CLARITY: the speech engine's own confidence in what it heard, used as a
 *    proxy for how intelligible the delivery was. If the recognizer struggled,
 *    a human on a video call likely did too — especially on technical terms.
 */

const FILLER_WORDS = [
  "um",
  "uh",
  "erm",
  "hmm",
  "like",
  "you know",
  "basically",
  "actually",
  "sort of",
  "kind of",
];

/**
 * Weak-commitment phrases. Deliberately disjoint from FILLER_WORDS so the two
 * metrics never double-count the same words — these measure conviction, not
 * verbal tics.
 */
const HEDGE_PHRASES = [
  "i think",
  "i guess",
  "i feel like",
  "maybe",
  "perhaps",
  "probably",
  "possibly",
  "i'm not sure",
  "not entirely sure",
  "not totally sure",
  "not really sure",
  "i could be wrong",
  "correct me if i'm wrong",
  "or something",
  "or whatever",
  "i would say",
  "i'd say",
  "hopefully",
  "if that makes sense",
  "i'm no expert",
  "i'm not an expert",
  "i assume",
  "i suppose",
  "somewhat",
];

/**
 * Builds a matcher tolerant of what speech-to-text actually emits: flexible
 * whitespace, and apostrophes that may be typographic, straight, or dropped
 * entirely ("I'm" / "I'm" / "Im").
 */
function phraseRegex(phrase: string): RegExp {
  const pattern = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/'/g, "['’]?")
    .replace(/ /g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`, "g");
}

function countPhrases(text: string, phrases: string[]): number {
  const haystack = ` ${text.toLowerCase()} `;
  let count = 0;
  for (const p of phrases) {
    count += (haystack.match(phraseRegex(p)) ?? []).length;
  }
  return count;
}

export function countFillers(text: string): number {
  return countPhrases(text, FILLER_WORDS);
}

export function countHedges(text: string): number {
  return countPhrases(text, HEDGE_PHRASES);
}

/**
 * Averages per-phrase recognition confidence into a 0-100 clarity score.
 * Returns null when the browser reported no usable confidence values — Chrome
 * populates them, others may not, and recording 0 there would look like a
 * terrible score rather than "not measured".
 */
export function clarityScore(confidences: number[]): number | null {
  const usable = confidences.filter(
    (c) => typeof c === "number" && c > 0 && c <= 1
  );
  if (usable.length === 0) return null;
  const avg = usable.reduce((a, b) => a + b, 0) / usable.length;
  return Math.round(avg * 100);
}

/**
 * Heuristic bands for presenting a clarity score. Thresholds are tuned by feel,
 * not calibrated against ground truth — treat them as coaching nudges.
 */
export function clarityLabel(score: number): {
  label: string;
  tone: "good" | "ok" | "poor";
} {
  if (score >= 85) return { label: "Very clear", tone: "good" };
  if (score >= 70) return { label: "Clear", tone: "good" };
  if (score >= 55) return { label: "Sometimes unclear", tone: "ok" };
  return { label: "Hard to make out", tone: "poor" };
}

/** Per-100-words rate, so long and short answers compare fairly. */
export function per100Words(count: number, text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.round((count / words) * 100 * 10) / 10;
}
