/**
 * Honest scoring.
 *
 * The model proposes per-criterion judgements; this module decides the number.
 * That split matters: a prompt asking the model to "be strict" is a request it
 * can drift away from, especially when it has just been told to sound warm and
 * encouraging. A non-answer scoring zero has to be arithmetic, not etiquette.
 */

export type Verdict =
  | "unanswered"
  | "incorrect"
  | "partially_correct"
  | "correct";

export const VERDICTS: Verdict[] = [
  "unanswered",
  "incorrect",
  "partially_correct",
  "correct",
];

/**
 * Correctness dominates by design: a fluent, well-structured, confident wrong
 * answer must not out-score a blunt right one. Delivery is worth a fifth of
 * the mark between them, and only ever on top of substance.
 */
export const CRITERIA_WEIGHTS = {
  correctness: 0.6,
  depth: 0.2,
  structure: 0.1,
  clarity: 0.1,
} as const;

/** An incorrect answer can never look like a pass, however well it was argued. */
export const INCORRECT_SCORE_CAP = 3;
/** A partially correct answer tops out below "solid". */
export const PARTIAL_SCORE_CAP = 6;

export interface Criteria {
  correctness: number;
  depth: number;
  structure: number;
  clarity: number;
}

/* ------------------------------------------------------------------ *
 * Non-answer detection
 * ------------------------------------------------------------------ */

/**
 * Phrases that are the whole answer when someone is giving up. Matched against
 * the entire normalised reply, not searched for inside it, so "I don't know the
 * exact GC algorithm, but it's generational and runs on a separate thread"
 * stays a real answer — because it is one.
 */
const GIVE_UP_PATTERNS: RegExp[] = [
  /^i? ?(really |honestly |actually )?(do ?n[o']?t|dont|donot) know\b/,
  /^no (idea|clue|clude|clu)\b/,
  /^not? ?(a )?clue\b/,
  /^idk\b/,
  /^dk\b/,
  /^dunno\b/,
  /^i ?(am|'m)? ?not sure\b/,
  /^unsure\b/,
  /^no comment\b/,
  /^skip\b/,
  /^pass\b/,
  /^next( one| question| q)?\b/,
  /^move on\b/,
  /^i (have|'ve) no idea\b/,
  /^cant? (answer|say|remember)\b/,
  /^i (cannot|can ?not|can'?t) (answer|say|remember|recall)\b/,
  /^never (heard|used|learned|learnt|studied)\b/,
  /^havent? (heard|used|learned|learnt|studied)\b/,
  /^forgot\b/,
  /^i forgot\b/,
  /^nothing\b/,
  /^none\b/,
  /^n\/?a\b/,
  /^\?+$/,
  /^(um+|uh+|hmm+|erm+)\b/,
];

/**
 * Words that carry no subject matter. A reply made only of these is filler,
 * however long it is.
 */
const FILLER_WORDS = new Set([
  "i","im","i'm","id","ive","a","an","the","is","are","am","was","were","be","been",
  "do","dont","don't","does","did","not","no","nope","yes","yeah","yep","ok","okay",
  "so","um","uh","hmm","erm","like","just","really","actually","honestly","maybe",
  "sorry","well","and","or","but","if","then","this","that","it","its","it's","to",
  "of","in","on","for","with","my","me","you","know","think","guess","sure","idk",
  "next","skip","pass","question","one","thing","stuff","something","anything",
  "nothing","much","very","quite","kind","sort","bit","can","cant","can't","cannot",
  "have","havent","haven't","had","has","will","would","could","should","let","us",
]);

/** Normalises a reply for matching: lowercase, punctuation stripped, collapsed. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'/?+#.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Content words: everything that isn't filler or a bare number. */
export function contentWords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ""))
    .filter((w) => w.length > 1 && !FILLER_WORDS.has(w));
}

export interface NonAnswerResult {
  isNonAnswer: boolean;
  /** Why, for the transcript record and for steering the next question. */
  reason: "empty" | "gave_up" | "no_content" | null;
}

/**
 * Decides whether a reply is a non-answer: silence, a refusal, or words with
 * no subject matter in them.
 *
 * Deliberately conservative about the give-up phrases — they only count when
 * the reply is *just* that phrase (optionally with a short apology or a nudge
 * to move on). Someone who says "I don't know, but I'd guess it hashes the key
 * and mods by bucket count" has answered, and scoring that zero would be its
 * own kind of dishonesty.
 */
export function detectNonAnswer(answer: string | null | undefined): NonAnswerResult {
  if (!answer || !answer.trim()) return { isNonAnswer: true, reason: "empty" };

  const norm = normalize(answer);
  if (!norm) return { isNonAnswer: true, reason: "empty" };

  const words = contentWords(answer);

  // A give-up opener only settles it when nothing of substance follows. The
  // threshold is 3 content words: "no idea sorry" is giving up, "no idea, but
  // event loop drains microtasks first" is an attempt.
  if (GIVE_UP_PATTERNS.some((re) => re.test(norm)) && words.length < 3) {
    return { isNonAnswer: true, reason: "gave_up" };
  }

  // Nothing but filler, regardless of length.
  if (words.length === 0) return { isNonAnswer: true, reason: "no_content" };

  return { isNonAnswer: false, reason: null };
}

/* ------------------------------------------------------------------ *
 * Score computation
 * ------------------------------------------------------------------ */

const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

/**
 * Turns per-criterion marks into the single 0-10 score, applying the caps that
 * keep a verdict and its number telling the same story.
 */
export function computeScore(criteria: Criteria, verdict: Verdict): number {
  if (verdict === "unanswered") return 0;

  const weighted =
    clamp10(criteria.correctness) * CRITERIA_WEIGHTS.correctness +
    clamp10(criteria.depth) * CRITERIA_WEIGHTS.depth +
    clamp10(criteria.structure) * CRITERIA_WEIGHTS.structure +
    clamp10(criteria.clarity) * CRITERIA_WEIGHTS.clarity;

  let score = weighted;
  if (verdict === "incorrect") score = Math.min(score, INCORRECT_SCORE_CAP);
  if (verdict === "partially_correct") score = Math.min(score, PARTIAL_SCORE_CAP);

  // Correctness also caps directly, so a model that says "correct" while
  // marking correctness 2 can't smuggle a pass through the verdict field.
  score = Math.min(score, clamp10(criteria.correctness) + 2);

  return Math.round(clamp10(score) * 10) / 10;
}

export interface ResolvedEval {
  score: number;
  verdict: Verdict;
  criteria: Criteria;
  note: string;
  /** What the right answer was — required whenever they didn't get there. */
  model_answer: string;
  tags: string[];
  depth?: number;
  /** True when the server overrode the model's judgement. */
  overridden: boolean;
}

export interface ModelEval {
  verdict?: string;
  criteria?: Partial<Criteria>;
  note?: string;
  model_answer?: string;
  tags?: string[];
  depth?: number;
  /** Legacy single score from before criteria existed. */
  score?: number;
}

const ZERO_CRITERIA: Criteria = {
  correctness: 0,
  depth: 0,
  structure: 0,
  clarity: 0,
};

/**
 * The authority on what an answer scored.
 *
 * Takes the candidate's actual words plus whatever the model proposed, and
 * returns the score of record. The server's own reading of the answer wins:
 * if the text is a non-answer it is a zero, no matter how generously the model
 * marked it.
 */
export function resolveEval(
  answer: string | null | undefined,
  model: ModelEval | null | undefined
): ResolvedEval {
  const nonAnswer = detectNonAnswer(answer);

  if (nonAnswer.isNonAnswer) {
    return {
      score: 0,
      verdict: "unanswered",
      criteria: ZERO_CRITERIA,
      note:
        nonAnswer.reason === "empty"
          ? "No answer given."
          : "Did not attempt the question.",
      model_answer: model?.model_answer?.trim() || "",
      tags: dedupeTags([...(model?.tags ?? []), "unanswered"]),
      depth: model?.depth,
      overridden: true,
    };
  }

  const criteria = normalizeCriteria(model);
  const verdict = normalizeVerdict(model?.verdict, criteria);
  const score = computeScore(criteria, verdict);

  return {
    score,
    verdict,
    criteria,
    note: model?.note?.trim() || "",
    model_answer: model?.model_answer?.trim() || "",
    tags: dedupeTags(model?.tags ?? []),
    depth: model?.depth,
    // The model never sets the number; this module always does.
    overridden: typeof model?.score === "number" && model.score !== score,
  };
}

/**
 * Fills in criteria from whatever the model returned. An older-shaped eval
 * carrying only `score` is spread across the criteria so existing transcripts
 * still resolve to something sane.
 */
function normalizeCriteria(model: ModelEval | null | undefined): Criteria {
  const c = model?.criteria;
  if (
    c &&
    typeof c.correctness === "number" &&
    typeof c.depth === "number" &&
    typeof c.structure === "number" &&
    typeof c.clarity === "number"
  ) {
    return {
      correctness: clamp10(c.correctness),
      depth: clamp10(c.depth),
      structure: clamp10(c.structure),
      clarity: clamp10(c.clarity),
    };
  }
  const legacy = typeof model?.score === "number" ? clamp10(model.score) : 0;
  return {
    correctness: legacy,
    depth: typeof c?.depth === "number" ? clamp10(c.depth) : legacy,
    structure: typeof c?.structure === "number" ? clamp10(c.structure) : legacy,
    clarity: typeof c?.clarity === "number" ? clamp10(c.clarity) : legacy,
  };
}

/**
 * A verdict the model didn't give (or gave nonsensically) is derived from the
 * correctness mark, so the two can never contradict each other.
 */
function normalizeVerdict(raw: string | undefined, criteria: Criteria): Verdict {
  const v = raw?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v && (VERDICTS as string[]).includes(v)) {
    const stated = v as Verdict;
    // "correct" with a failing correctness mark is a contradiction; believe the
    // mark, which is the thing the rubric actually asked them to assess.
    if (stated === "correct" && criteria.correctness < 6) {
      return criteria.correctness < 3 ? "incorrect" : "partially_correct";
    }
    if (stated === "unanswered") {
      // Only the server decides "unanswered" — the text said otherwise.
      return criteria.correctness < 3 ? "incorrect" : "partially_correct";
    }
    return stated;
  }
  if (criteria.correctness >= 7.5) return "correct";
  if (criteria.correctness >= 4) return "partially_correct";
  return "incorrect";
}

function dedupeTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(
    0,
    8
  );
}

/* ------------------------------------------------------------------ *
 * Aggregation
 * ------------------------------------------------------------------ */

export interface Tally {
  asked: number;
  answered: number;
  unanswered: number;
  correct: number;
  partially_correct: number;
  incorrect: number;
}

export const EMPTY_TALLY: Tally = {
  asked: 0,
  answered: 0,
  unanswered: 0,
  correct: 0,
  partially_correct: 0,
  incorrect: 0,
};

export function tallyEvals(
  evals: { verdict?: string | null }[],
  asked: number
): Tally {
  const t: Tally = { ...EMPTY_TALLY, asked };
  for (const e of evals) {
    switch (e.verdict) {
      case "unanswered":
        t.unanswered++;
        break;
      case "correct":
        t.answered++;
        t.correct++;
        break;
      case "partially_correct":
        t.answered++;
        t.partially_correct++;
        break;
      case "incorrect":
        t.answered++;
        t.incorrect++;
        break;
    }
  }
  return t;
}

/**
 * The headline score, computed from the per-question scores rather than asked
 * for as a free-form judgement.
 *
 * Questions that were asked but never reached (the candidate ended early) are
 * excluded; questions they were asked and didn't answer are included as zeros,
 * because declining to answer is part of how the round went.
 */
export function overallScoreFromEvals(
  evals: { score: number }[]
): number {
  if (evals.length === 0) return 0;
  const mean = evals.reduce((sum, e) => sum + e.score, 0) / evals.length;
  return Math.round(clamp10(mean) * 10);
}
