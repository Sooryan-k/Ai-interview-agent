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
export const EvalSchema = z.object({
  score: z.number().min(0).max(10),
  note: z.string(),
  tags: z.array(z.string()).catch([]),
  /** Depth-ladder rounds only: which rung this answer was on. */
  depth: z.number().int().min(1).max(20).optional().catch(undefined),
});
export type TurnEval = z.infer<typeof EvalSchema>;

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
