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

// ---------- Wire protocol constants ----------
export const EVAL_SENTINEL = "<<<EVAL>>>";
export const END_MARKER = "[END_OF_INTERVIEW]";
