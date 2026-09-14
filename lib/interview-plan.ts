import { isStackId, stackName } from "@/lib/stacks";

/**
 * How long an interview is, and what each question is about.
 *
 * The length is a function of the stack selection, decided here on the server
 * at creation time and stored on the session — never re-derived per turn and
 * never left to the model to decide.
 */

/** A single stack gets a full ladder from basics to advanced. */
export const SINGLE_STACK_QUESTIONS = 12;
/** Every stack in a multi-stack round gets this many questions. */
export const QUESTIONS_PER_STACK = 5;

/**
 * Rounds whose length comes from the stack selection. The others are not
 * stack-quizzes and keep their own pacing:
 *  - depth    — a ladder; its length is the rung ceiling, not a question count.
 *  - hr       — a conversation about motivation and expectations.
 *  - negotiation — a haggle; "questions" are offers and counters.
 *  - behavioral  — about the candidate's history, not their technologies.
 */
export const STACK_DRIVEN_ROUNDS = new Set([
  "technical",
  "system_design",
  "dsa",
  "repo",
]);

/** Fallback lengths for rounds the stack selection doesn't drive. */
export const QUESTIONS_BY_DIFFICULTY: Record<string, number> = {
  easy: 10,
  medium: 12,
  hard: 15,
};

/**
 * Depth ladders climb further than a normal round has questions — the rung
 * count is an upper bound the candidate usually never reaches, because the
 * ladder stops the moment it finds their ceiling.
 */
export const LADDER_RUNGS_BY_DIFFICULTY: Record<string, number> = {
  easy: 6,
  medium: 8,
  hard: 10,
};

export interface StackAllocation {
  stackId: string;
  count: number;
}

export interface QuestionPlan {
  total: number;
  perStack: StackAllocation[];
  /** Which stack question 1, 2, 3 … belongs to. Length === total. */
  sequence: string[];
}

/**
 * Total questions for a stack selection.
 *
 * One stack means a single ladder of 12 from basics upward; two or more means
 * five each, so the total scales with how much ground the candidate asked to
 * cover (6 stacks = 30 questions).
 */
export function totalQuestionsForStacks(stackIds: string[]): number {
  const unique = dedupe(stackIds);
  if (unique.length === 0) return 0;
  if (unique.length === 1) return SINGLE_STACK_QUESTIONS;
  return unique.length * QUESTIONS_PER_STACK;
}

/**
 * Builds the full plan, including the order questions are asked in.
 *
 * The sequence round-robins rather than finishing one stack before starting the
 * next, because a real interviewer moves between technologies as the
 * conversation goes — being asked five straight React questions and then five
 * straight Postgres ones feels like two separate quizzes stapled together.
 */
export function buildQuestionPlan(stackIds: string[]): QuestionPlan {
  const unique = dedupe(stackIds);
  if (unique.length === 0) {
    return { total: 0, perStack: [], sequence: [] };
  }

  const per =
    unique.length === 1 ? SINGLE_STACK_QUESTIONS : QUESTIONS_PER_STACK;
  const perStack = unique.map((stackId) => ({ stackId, count: per }));

  // Round-robin: one question from each stack in turn, repeatedly. With equal
  // counts this lands every stack on exactly `per` questions.
  const sequence: string[] = [];
  for (let round = 0; round < per; round++) {
    for (const stackId of unique) sequence.push(stackId);
  }

  return { total: unique.length * per, perStack, sequence };
}

/**
 * The planned length for a session. Stack-driven rounds use the selection;
 * everything else keeps its difficulty-based pacing.
 */
export function plannedQuestionsFor(args: {
  roundType: string;
  difficulty: string;
  stackIds: string[];
}): number {
  if (args.roundType === "depth") {
    return LADDER_RUNGS_BY_DIFFICULTY[args.difficulty] ?? 8;
  }
  if (STACK_DRIVEN_ROUNDS.has(args.roundType)) {
    const total = totalQuestionsForStacks(args.stackIds);
    // No recognised stacks (free-text round track) — fall back to difficulty.
    if (total > 0) return total;
  }
  return QUESTIONS_BY_DIFFICULTY[args.difficulty] ?? 12;
}

export interface PlanDescription {
  count: number;
  /** "question" / "rung", already singular — the caller pluralises. */
  unit: string;
  /** Explains where the number came from. Never restates the number itself. */
  detail: string;
}

/**
 * How the plan reads to the candidate, shown before they start so the length
 * is never a surprise.
 */
export function describePlan(args: {
  roundType: string;
  difficulty: string;
  stackIds: string[];
}): PlanDescription {
  const count = plannedQuestionsFor(args);

  if (args.roundType === "depth") {
    return {
      count,
      unit: "rung",
      detail: "the ladder stops as soon as it finds your ceiling",
    };
  }

  const unique = dedupe(args.stackIds);
  if (STACK_DRIVEN_ROUNDS.has(args.roundType) && unique.length === 1) {
    return {
      count,
      unit: "question",
      detail: `all on ${stackName(unique[0]) ?? unique[0]}, building from the basics upward`,
    };
  }
  if (STACK_DRIVEN_ROUNDS.has(args.roundType) && unique.length > 1) {
    return {
      count,
      unit: "question",
      detail: `${QUESTIONS_PER_STACK} per technology across ${unique.length}, rotating between them`,
    };
  }
  return {
    count,
    unit: "question",
    detail: `the standard length for a ${args.difficulty} ${args.roundType.replace("_", " ")} round`,
  };
}

/**
 * Which stack the next question should be about, from the stored plan.
 * Returns null once the plan is exhausted or when there is no plan.
 */
export function stackForQuestion(
  plan: QuestionPlan | null | undefined,
  questionIndex: number
): string | null {
  if (!plan || plan.sequence.length === 0) return null;
  return plan.sequence[questionIndex] ?? null;
}

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!isStackId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
