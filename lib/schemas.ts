import { z } from "zod";

// ---------- Curriculum (scratch -> expert path) ----------
export const TopicSchema = z.object({
  key: z.string(),
  title: z.string(),
  objective: z.string(),
  est_minutes: z.number().int().positive().catch(30),
});

export const ModuleSchema = z.object({
  key: z.string(),
  title: z.string(),
  topics: z.array(TopicSchema).min(1),
});

export const LevelSchema = z.object({
  key: z.string(),
  title: z.string(),
  summary: z.string(),
  modules: z.array(ModuleSchema).min(1),
});

export const CurriculumSchema = z.object({
  stack_label: z.string(),
  levels: z.array(LevelSchema).min(3),
});
export type Curriculum = z.infer<typeof CurriculumSchema>;
export type CurriculumLevel = z.infer<typeof LevelSchema>;
export type CurriculumTopic = z.infer<typeof TopicSchema>;

// ---------- Study material ----------
export const StudyMaterialSchema = z.object({
  content_md: z.string(),
  cheat_sheet_md: z.string().catch(""),
  resources: z
    .array(z.object({ title: z.string(), url: z.string() }))
    .catch([]),
  interview_questions: z.array(z.string()).catch([]),
});
export type StudyMaterial = z.infer<typeof StudyMaterialSchema>;

// ---------- Per-answer eval (hidden block in each turn) ----------
/**
 * The eval of record, as stored on the candidate's turn. `score` and `verdict`
 * are computed by lib/scoring.ts from `criteria` — the model proposes the
 * criteria, the server decides the number.
 *
 * Everything beyond the original four fields is optional so rows written before
 * per-criterion scoring existed still parse.
 */
export const EvalSchema = z.object({
  score: z.number().min(0).max(10),
  note: z.string(),
  tags: z.array(z.string()).catch([]),
  /** Depth-ladder rounds only: which rung this answer was on. */
  depth: z.number().int().min(1).max(20).optional().catch(undefined),
  verdict: z
    .enum(["unanswered", "incorrect", "partially_correct", "correct"])
    .optional()
    .catch(undefined),
  criteria: z
    .object({
      correctness: z.number().min(0).max(10),
      depth: z.number().min(0).max(10),
      structure: z.number().min(0).max(10),
      clarity: z.number().min(0).max(10),
    })
    .optional()
    .catch(undefined),
  /** What a correct answer was — present whenever they didn't give one. */
  model_answer: z.string().optional().catch(undefined),
});
export type TurnEval = z.infer<typeof EvalSchema>;

/**
 * What the model proposes about the previous answer. Every field is optional
 * and nothing is trusted as final: lib/scoring.ts resolves this against the
 * candidate's actual words.
 */
export const ModelEvalSchema = z.object({
  verdict: z.string().optional().catch(undefined),
  criteria: z
    .object({
      correctness: z.number().optional().catch(undefined),
      depth: z.number().optional().catch(undefined),
      structure: z.number().optional().catch(undefined),
      clarity: z.number().optional().catch(undefined),
    })
    .partial()
    .optional()
    .catch(undefined),
  note: z.string().optional().catch(undefined),
  model_answer: z.string().optional().catch(undefined),
  tags: z.array(z.string()).optional().catch([]),
  depth: z.number().optional().catch(undefined),
  /** Legacy shape: a bare score with no criteria behind it. */
  score: z.number().optional().catch(undefined),
});
export type ModelEvalInput = z.infer<typeof ModelEvalSchema>;

/**
 * What the question just asked was about. Recorded per turn so the next
 * interview on the same stack can exclude it.
 */
export const QuestionMetaSchema = z.object({
  /** Catalog id from lib/stacks.ts, or "" when the round isn't stack-driven. */
  stack: z.string().catch(""),
  topic: z.string().catch(""),
  difficulty: z.string().catch("medium"),
  /** The question on its own, without the acknowledgement that preceded it. */
  text: z.string().catch(""),
});
export type QuestionMeta = z.infer<typeof QuestionMetaSchema>;

export interface TurnMeta {
  eval: ModelEvalInput | null;
  question: QuestionMeta | null;
}

/**
 * Parses the hidden block that follows EVAL_SENTINEL.
 *
 * Accepts three shapes, because the protocol changed and old transcripts must
 * keep working:
 *  - `{"eval": {...}|null, "question": {...}|null}` — current.
 *  - `{"score": 7, "note": "…"}` — the original bare eval.
 *  - `null` — the opening turn, where there is no previous answer.
 *
 * Never throws: a malformed block costs the metadata for one turn, which is
 * recoverable, whereas throwing would lose the turn itself.
 */
export function parseTurnMeta(raw: string): TurnMeta {
  const empty: TurnMeta = { eval: null, question: null };
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!cleaned || cleaned === "null") return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;

  const obj = parsed as Record<string, unknown>;

  // Legacy: the object IS the eval.
  if (!("eval" in obj) && !("question" in obj)) {
    const legacy = ModelEvalSchema.safeParse(obj);
    return { eval: legacy.success ? legacy.data : null, question: null };
  }

  const evalResult =
    obj.eval && typeof obj.eval === "object"
      ? ModelEvalSchema.safeParse(obj.eval)
      : null;
  const questionResult =
    obj.question && typeof obj.question === "object"
      ? QuestionMetaSchema.safeParse(obj.question)
      : null;

  return {
    eval: evalResult?.success ? evalResult.data : null,
    question: questionResult?.success ? questionResult.data : null,
  };
}

// ---------- End-of-interview report ----------
export const ReportSchema = z.object({
  overall_score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  per_question: z.array(
    z.object({
      q: z.string(),
      answer_summary: z.string(),
      model_answer: z.string(),
      score: z.number().min(0).max(10),
    })
  ),
  recommendations: z.array(z.string()),
});
export type Report = z.infer<typeof ReportSchema>;

// ---------- Module quiz (global cache in `quizzes` table) ----------
export const QuizMcqSchema = z.object({
  type: z.literal("mcq"),
  q: z.string(),
  options: z.array(z.string()).min(2).max(6),
  answer: z.number().int().min(0), // index into options
  explanation: z.string().catch(""),
});

export const QuizShortSchema = z.object({
  type: z.literal("short"),
  q: z.string(),
  ideal_points: z.array(z.string()).min(1),
  explanation: z.string().catch(""),
});

export const QuizQuestionSchema = z.discriminatedUnion("type", [
  QuizMcqSchema,
  QuizShortSchema,
]);

export const QuizSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(3),
});
export type Quiz = z.infer<typeof QuizSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

// ---------- Question bank seeding (global cache in `question_bank`) ----------
export const BankSeedSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        ideal_points: z.array(z.string()).catch([]),
        tags: z.array(z.string()).catch([]),
      })
    )
    .min(5),
});
export type BankSeed = z.infer<typeof BankSeedSchema>;

// ---------- Resume structuring (profiles.resume_struct) ----------
export const ResumeStructSchema = z.object({
  summary: z.string().catch(""),
  years_experience: z.number().catch(0),
  skills: z.array(z.string()).catch([]),
  highlights: z.array(z.string()).catch([]),
  gaps: z.array(z.string()).catch([]),
});
export type ResumeStruct = z.infer<typeof ResumeStructSchema>;

// ---------- Roast (fun, shareable) ----------
export const RoastSchema = z.object({
  roast_md: z.string(),
  fixes: z.array(z.string()).catch([]),
});
export type Roast = z.infer<typeof RoastSchema>;

// ---------- Whiteboard (system-design diagram critique via vision) ----------
export const WhiteboardCritiqueSchema = z.object({
  overall_score: z.number().min(0).max(100),
  components_identified: z.array(z.string()).catch([]),
  strengths: z.array(z.string()).catch([]),
  bottlenecks: z.array(z.string()).catch([]),
  missing_pieces: z.array(z.string()).catch([]),
  follow_up_questions: z.array(z.string()).catch([]),
  verdict: z.string().catch(""),
});
export type WhiteboardCritique = z.infer<typeof WhiteboardCritiqueSchema>;

// ---------- Coding round review ----------
export const CodeReviewSchema = z.object({
  overall_score: z.number().min(0).max(100),
  correctness: z.string().catch(""),
  complexity: z.string().catch(""),
  strengths: z.array(z.string()).catch([]),
  improvements: z.array(z.string()).catch([]),
  cleaner_approach: z.string().catch(""),
});
export type CodeReview = z.infer<typeof CodeReviewSchema>;

// ---------- Wire protocol constants ----------
export const EVAL_SENTINEL = "<<<EVAL>>>";
export const END_MARKER = "[END_OF_INTERVIEW]";

/**
 * Wraps the core answer inside a "show me the answer" reply, so the UI can
 * highlight just that part and leave the surrounding chatter plain.
 *
 * XML-style tags on purpose: the previous "[[A]] … [[/A]]" pair was emitted
 * with a mangled closer ("[/A]]") often enough to break parsing, because the
 * "[[/" sequence is awkward to reproduce. Models close an XML tag reliably.
 */
export const ANSWER_OPEN = "<ANS>";
export const ANSWER_CLOSE = "</ANS>";

// Close first: "[[/A]]" must not be mistaken for an opening "[[A]]".
const CLOSE_VARIANTS = /<\s*\/\s*ans\s*>|\[\[?\s*\/\s*(?:a|ans|answer)\s*\]\]/gi;
const OPEN_VARIANTS = /<\s*ans\s*>|\[\[\s*(?:a|ans|answer)\s*\]\]/gi;

/**
 * Repairs near-miss markers before parsing. Also lets transcripts recorded
 * with the old bracket markers keep rendering correctly.
 */
function normalizeMarkers(text: string): string {
  return text
    .replace(CLOSE_VARIANTS, ANSWER_CLOSE)
    .replace(OPEN_VARIANTS, ANSWER_OPEN);
}

/**
 * Strips answer markers for contexts that must never show them — speech
 * synthesis and the live streaming view. Also removes a partial marker left
 * at the tail of an in-flight stream (e.g. "[[" or "[[/A") so it can't flash
 * on screen or get read aloud.
 */
export function stripAnswerMarkers(text: string): string {
  return normalizeMarkers(text)
    .split(ANSWER_OPEN)
    .join("")
    .split(ANSWER_CLOSE)
    .join("")
    // A tag still arriving at the tail of an in-flight stream ("<", "</AN"…).
    .replace(/<\/?[A-Za-z]*$/, "")
    .replace(/\[{1,2}\/?[A-Za-z]*\]?$/, "");
}

export interface AnswerSegment {
  text: string;
  isAnswer: boolean;
}

/**
 * Splits a message into plain and answer segments for rendering. An
 * unterminated marker degrades to plain text rather than swallowing the rest
 * of the message, so a malformed model response still reads correctly.
 */
export function splitAnswerSegments(text: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let rest = normalizeMarkers(text);

  for (;;) {
    const open = rest.indexOf(ANSWER_OPEN);
    if (open === -1) break;
    const close = rest.indexOf(ANSWER_CLOSE, open + ANSWER_OPEN.length);
    if (close === -1) break;
    if (open > 0) segments.push({ text: rest.slice(0, open), isAnswer: false });
    segments.push({
      text: rest.slice(open + ANSWER_OPEN.length, close).trim(),
      isAnswer: true,
    });
    rest = rest.slice(close + ANSWER_CLOSE.length);
  }

  if (rest) segments.push({ text: rest, isAnswer: false });
  return segments;
}
