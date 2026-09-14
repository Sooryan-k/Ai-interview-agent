/**
 * Per-user question history and repeat detection.
 *
 * The goal is that a second interview on the same stack never re-asks what the
 * first one did — including the reworded version, which is what actually
 * happens in practice ("What is the virtual DOM?" → "Can you explain how
 * React's virtual DOM works?" are the same question).
 *
 * Similarity is computed from content-word overlap rather than embeddings: it
 * needs no API call, which keeps the whole feature inside the free tier, and
 * it runs synchronously while a turn is streaming.
 */

/** Above this overlap of content concepts, two questions are the same question. */
export const DUPLICATE_THRESHOLD = 0.6;

/**
 * Words that say nothing about the subject. Interview questions are built
 * almost entirely from this vocabulary ("can you explain how X works"), so
 * leaving them in would make every question look like every other one.
 */
const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","do","does","did",
  "can","could","would","should","will","shall","may","might","must","have","has",
  "had","i","you","we","they","it","its","this","that","these","those","what",
  "which","who","whom","whose","when","where","why","how","and","or","but","if",
  "then","than","so","because","as","of","in","on","at","to","for","with","from",
  "by","about","into","over","under","between","through","during","me","my","your",
  "our","their","tell","explain","describe","walk","me","through","give","say",
  "talk","discuss","think","know","understand","use","using","used","work","works",
  "working","happen","happens","happening","mean","means","difference","between",
  "example","examples","one","two","some","any","all","each","every","other",
  "another","more","most","much","many","few","little","own","same","also","just",
  "very","really","actually","please","let","lets","s","t","re","ve","ll","d",
  // Generic verbs an interview question is built from. "How do you add an index"
  // and "why does adding an index help" are about indexes, not about adding.
  "make","makes","made","add","adds","get","gets","got","take","takes","put",
  "puts","need","needs","want","wants","go","goes","come","comes","see","look",
  "find","finds","handle","handles","deal","reach","call","calls","run","runs",
  "actually","ever","still","yet","really","instead","rather","would","might",
]);

/**
 * Phrasings that mean the same thing, collapsed to one token.
 *
 * Without this, "How does indexing speed up a query?" and "Why does adding an
 * index make queries faster?" share almost no words despite being the same
 * question. This is the cheap stand-in for embeddings: it covers the handful of
 * axes interview questions actually vary on — speed, difference, benefit,
 * failure — rather than trying to model language in general.
 */
const SYNONYMS: Record<string, string> = {
  fast: "fast", faster: "fast", quick: "fast", quicker: "fast",
  speed: "fast", speedup: "fast", performance: "fast", performant: "fast",
  efficient: "fast", efficiency: "fast", optimize: "fast", optimization: "fast",
  slow: "slow", slower: "slow", bottleneck: "slow", latency: "slow",
  differ: "diff", difference: "diff", different: "diff", vs: "diff",
  versus: "diff", compare: "diff", comparison: "diff", contrast: "diff",
  distinguish: "diff", distinction: "diff",
  benefit: "advantage", advantage: "advantage", pro: "advantage",
  upside: "advantage", strength: "advantage",
  drawback: "drawback", disadvantage: "drawback", downside: "drawback",
  con: "drawback", limitation: "drawback", weakness: "drawback",
  tradeoff: "tradeoff", "trade-off": "tradeoff",
  problem: "problem", issue: "problem", bug: "problem", pitfall: "problem",
  gotcha: "problem", mistake: "problem", error: "problem",
  fail: "fail", failure: "fail", break: "fail", breaks: "fail", crash: "fail",
  purpose: "purpose", reason: "purpose", point: "purpose", goal: "purpose",
};

/**
 * Light suffix stripping so "optimising", "optimise" and "optimisation" collapse
 * to one token. Deliberately crude — a real stemmer is overkill for matching
 * two interview questions, and over-stemming creates false duplicates.
 */
function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ization")) return w.slice(0, -7) + "ize";
  if (w.length > 5 && w.endsWith("isation")) return w.slice(0, -7) + "ize";
  if (w.length > 4 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/**
 * The content tokens of a question, stemmed, canonicalised and de-duplicated.
 *
 * `context` words are dropped as noise. Pass the technology's own name: within
 * a React question history, "in React" appears in half the questions and says
 * nothing about which question it is.
 */
export function questionTokens(question: string, context: string[] = []): string[] {
  const ignore = new Set(
    context.flatMap((c) =>
      c
        .toLowerCase()
        .split(/[^\p{L}\p{N}+#.]+/u)
        .filter(Boolean)
        .flatMap((w) => [w, stem(w)])
    )
  );

  const words = question
    .toLowerCase()
    // Keep +, # and . so "c++", "c#" and "node.js" survive as single tokens.
    .replace(/[^\p{L}\p{N}\s+#.]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !ignore.has(w))
    .map((w) => SYNONYMS[w] ?? stem(w))
    .map((w) => SYNONYMS[w] ?? w)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !ignore.has(w));
  return [...new Set(words)];
}

/**
 * An order-independent fingerprint, stored alongside each question so repeats
 * can be spotted with a string comparison before falling back to scoring.
 */
export function questionSignature(question: string, context: string[] = []): string {
  return questionTokens(question, context).sort().join(" ");
}

/**
 * How much subject matter two questions share, from 0 to 1.
 *
 * Not plain Jaccard: a question and its shorter rewording ("What is a closure
 * in JavaScript?" vs "Could you explain closures?") overlap completely on the
 * shorter one's terms, but Jaccard divides by the union and scores that 0.5 —
 * low enough to let the repeat through. Dividing by the smaller set plus half
 * the surplus keeps subset-rewordings high while still separating "What is
 * React?" from "What are React hooks?", where the extra term is the question.
 */
export function similarity(a: string, b: string, context: string[] = []): number {
  const ta = new Set(questionTokens(a, context));
  const tb = new Set(questionTokens(b, context));
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  if (shared === 0) return 0;

  const min = Math.min(ta.size, tb.size);
  const max = Math.max(ta.size, tb.size);
  return shared / (min + (max - min) / 2);
}

export interface HistoryEntry {
  question: string;
  signature?: string | null;
  topic?: string | null;
  stack_id?: string | null;
  difficulty?: string | null;
  asked_at?: string | null;
}

/**
 * Whether a candidate question repeats something already asked. Returns the
 * matching entry so the caller can say which one, rather than just "duplicate".
 */
export interface DuplicateOptions {
  threshold?: number;
  /** Words to treat as noise — normally the technology's own name. */
  context?: string[];
}

export function findDuplicate(
  question: string,
  history: HistoryEntry[],
  opts: DuplicateOptions = {}
): HistoryEntry | null {
  const { threshold = DUPLICATE_THRESHOLD, context = [] } = opts;
  if (questionTokens(question, context).length === 0) return null;

  const sig = questionSignature(question, context);
  for (const h of history) {
    // The stored signature was computed without context, so only trust it as a
    // fast path when no context is in play.
    if (context.length === 0 && h.signature && h.signature === sig) return h;
    if (similarity(question, h.question, context) >= threshold) return h;
  }
  return null;
}

export function isNearDuplicate(
  question: string,
  history: HistoryEntry[],
  opts: DuplicateOptions = {}
): boolean {
  return findDuplicate(question, history, opts) !== null;
}

/* ------------------------------------------------------------------ *
 * Exclusion lists
 * ------------------------------------------------------------------ */

/** Keeps the prompt bounded — the newest questions matter most. */
export const MAX_EXCLUSIONS_PER_STACK = 25;

/**
 * How close a stack is to running out of unasked ground. Past this many
 * questions on one technology, the interviewer is told to move to new
 * sub-topics or a higher difficulty rather than hunting for another phrasing
 * of something basic.
 */
export const POOL_PRESSURE_THRESHOLD = 20;

export interface StackExclusions {
  stackId: string;
  stackName: string;
  questions: string[];
  topics: string[];
  /** True once this stack has been covered enough to need fresh ground. */
  underPressure: boolean;
}

/**
 * Groups history into a per-stack exclusion list for the prompt. Questions are
 * de-duplicated against each other first, so twenty rephrasings of one question
 * don't crowd out the other nineteen topics.
 */
export function buildExclusions(
  history: HistoryEntry[],
  stackIds: string[],
  nameOf: (id: string) => string
): StackExclusions[] {
  return stackIds.map((stackId) => {
    const name = nameOf(stackId);
    const context = [name, stackId];
    const forStack = history
      .filter((h) => h.stack_id === stackId)
      .sort((a, b) => (b.asked_at ?? "").localeCompare(a.asked_at ?? ""));

    const questions: string[] = [];
    for (const h of forStack) {
      if (questions.length >= MAX_EXCLUSIONS_PER_STACK) break;
      // Collapse rephrasings so the list covers as much ground as it can.
      if (
        !isNearDuplicate(
          h.question,
          questions.map((q) => ({ question: q })),
          { context }
        )
      ) {
        questions.push(h.question);
      }
    }

    const topics = [
      ...new Set(forStack.map((h) => (h.topic ?? "").trim()).filter(Boolean)),
    ].slice(0, 30);

    return {
      stackId,
      stackName: name,
      questions,
      topics,
      underPressure: forStack.length >= POOL_PRESSURE_THRESHOLD,
    };
  });
}

/**
 * The prompt section listing what must not be asked again.
 *
 * Returns an empty string when there's no history, so a first interview carries
 * none of this weight in its context.
 */
export function exclusionPromptSection(exclusions: StackExclusions[]): string {
  const withHistory = exclusions.filter((e) => e.questions.length > 0);
  if (withHistory.length === 0) return "";

  const blocks = withHistory.map((e) => {
    const lines = e.questions.map((q) => `  - ${q}`).join("\n");
    const pressure = e.underPressure
      ? `\n  (${e.stackName} is well covered — go to sub-topics they have NOT been asked about, or raise the difficulty. Do not look for a new way to word something above.)`
      : "";
    const topics = e.topics.length
      ? `\n  Topics already covered: ${e.topics.join(", ")}.`
      : "";
    return `${e.stackName}:\n${lines}${topics}${pressure}`;
  });

  return `ALREADY ASKED — this candidate has had these questions in previous interviews. Do NOT ask any of them again, and do NOT ask a reworded version of one. "What is the virtual DOM?" and "Can you explain how React's virtual DOM works?" are the SAME question; both are banned once either has been asked. Choose different sub-topics instead.

${blocks.join("\n\n")}

If you genuinely cannot find unasked ground on a technology, ask a harder question about a topic listed above rather than repeating it at the same level, and open that question with the words "Coming back to" so the candidate knows it is revision.`;
}
