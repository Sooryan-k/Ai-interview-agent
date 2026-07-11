import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck, userStudyCheck } from "@/lib/quota";
import { quizPrompt } from "@/lib/prompts/quiz";
import { CurriculumSchema, QuizSchema } from "@/lib/schemas";
import { findModule } from "@/lib/curriculum";
import { touchStreak } from "@/lib/streak";

export const maxDuration = 60;

/**
 * Module quiz. [key] = module_key.
 * POST {curriculumId}          → quiz JSON (global cache-first; 1 smart call ever per module)
 * PUT  {curriculumId, score, total} → persist result into user_track_progress.quiz_scores
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key: moduleKey } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const curriculumId =
    typeof body?.curriculumId === "string" ? body.curriculumId : null;
  if (!curriculumId) {
    return NextResponse.json({ error: "missing curriculumId" }, { status: 400 });
  }

  // 1. Global cache hit — costs nothing.
  const { data: cached } = await supabase
    .from("quizzes")
    .select("questions")
    .eq("curriculum_id", curriculumId)
    .eq("module_key", moduleKey)
    .maybeSingle();
  if (cached) {
    return NextResponse.json({ quiz: { questions: cached.questions }, cached: true });
  }

  // 2. Validate the module exists in this curriculum.
  const { data: curriculumRow } = await supabase
    .from("curricula")
    .select("stack_label, structure")
    .eq("id", curriculumId)
    .maybeSingle();
  if (!curriculumRow) {
    return NextResponse.json({ error: "curriculum not found" }, { status: 404 });
  }
  const parsed = CurriculumSchema.safeParse(curriculumRow.structure);
  const mod = parsed.success ? findModule(parsed.data, moduleKey) : null;
  if (!mod) {
    return NextResponse.json({ error: "module not found" }, { status: 404 });
  }

  // 3. Quota, then generate once for everyone.
  const blocked = await consumeQuota(supabase, [
    globalCheck(),
    userStudyCheck(user.id),
  ]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          blocked === "global"
            ? "The free daily AI budget is spent — cached quizzes remain available."
            : "You've generated a lot today — try again tomorrow.",
      },
      { status: 429 }
    );
  }

  let quiz;
  try {
    const raw = await generateText({
      tier: "smart",
      prompt: quizPrompt({
        stackLabel: curriculumRow.stack_label,
        moduleTitle: mod.moduleTitle,
        levelTitle: mod.levelTitle,
        topics: mod.topics.map((t) => ({
          title: t.title,
          objective: t.objective,
        })),
      }),
      json: true,
      mockKind: "quiz",
    });
    quiz = QuizSchema.parse(parseJsonLoose(raw));
    // MCQ answer indices must be in range — drop malformed questions.
    quiz.questions = quiz.questions.filter(
      (q) => q.type !== "mcq" || (q.answer >= 0 && q.answer < q.options.length)
    );
    if (quiz.questions.length < 3) throw new Error("too few valid questions");
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("quiz generation failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // 4. Cache globally (service role bypasses RLS for the shared cache).
  const admin = createAdminClient();
  const { error: insertError } = await admin.from("quizzes").insert({
    curriculum_id: curriculumId,
    module_key: moduleKey,
    questions: quiz.questions,
  });
  if (insertError && insertError.code !== "23505") {
    console.error("quiz cache insert failed", insertError);
  }

  return NextResponse.json({ quiz, cached: false });
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key: moduleKey } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const curriculumId =
    typeof body?.curriculumId === "string" ? body.curriculumId : null;
  const score = Number(body?.score);
  const total = Number(body?.total);
  if (
    !curriculumId ||
    !Number.isFinite(score) ||
    !Number.isFinite(total) ||
    total <= 0 ||
    score < 0 ||
    score > total
  ) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("user_track_progress")
    .select("quiz_scores")
    .eq("user_id", user.id)
    .eq("curriculum_id", curriculumId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "not enrolled" }, { status: 404 });
  }

  const scores = (row.quiz_scores ?? {}) as Record<
    string,
    { score: number; total: number; pct: number; at: string; attempts: number }
  >;
  const prev = scores[moduleKey];
  scores[moduleKey] = {
    score,
    total,
    pct: Math.round((score / total) * 100),
    at: new Date().toISOString(),
    attempts: (prev?.attempts ?? 0) + 1,
  };

  const { error } = await supabase
    .from("user_track_progress")
    .update({ quiz_scores: scores, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("curriculum_id", curriculumId);
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const streak = await touchStreak(supabase, user.id);
  return NextResponse.json({ ok: true, streak });
}
