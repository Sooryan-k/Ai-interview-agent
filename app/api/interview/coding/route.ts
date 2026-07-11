import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck, userInterviewCheck } from "@/lib/quota";
import { codeReviewPrompt } from "@/lib/prompts/codeReview";
import { CodeReviewSchema } from "@/lib/schemas";
import { touchStreak } from "@/lib/streak";

export const maxDuration = 60;

/** AI code review at the end of a coding round → persisted as interview+report. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const problem = typeof body?.problem === "string" ? body.problem.slice(0, 1000) : "";
  const problemTitle =
    typeof body?.problemTitle === "string" ? body.problemTitle.slice(0, 120) : "Coding";
  const language = typeof body?.language === "string" ? body.language : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 8000) : "";
  const testsPassed = Number(body?.testsPassed) || 0;
  const testsTotal = Number(body?.testsTotal) || 0;
  if (!problem || !source || !language) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const blocked = await consumeQuota(supabase, [
    userInterviewCheck(user.id),
    globalCheck(),
  ]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message: "You've used today's free rounds — come back tomorrow.",
      },
      { status: 429 }
    );
  }

  let review;
  try {
    const raw = await generateText({
      tier: "smart",
      prompt: codeReviewPrompt({ problem, language, source, testsPassed, testsTotal }),
      json: true,
      mockKind: "codeReview",
    });
    review = CodeReviewSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("code review failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  const { data: interview, error: ivError } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      role_track: "Coding",
      round_type: "dsa",
      difficulty: "medium",
      persona: { mode: "coding", problem: problemTitle, language },
      status: "complete",
      ended_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (ivError || !interview) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  await supabase.from("reports").insert({
    interview_id: interview.id,
    user_id: user.id,
    overall_score: Math.round(review.overall_score),
    strengths: review.strengths,
    weaknesses: review.improvements,
    per_question: [
      {
        q: `${problemTitle} (${testsPassed}/${testsTotal} tests passed)`,
        answer_summary: review.correctness,
        model_answer: `${review.complexity} — ${review.cleaner_approach}`,
        score: Math.round(review.overall_score / 10),
      },
    ],
    recommendations: review.improvements,
  });

  await touchStreak(supabase, user.id);
  return NextResponse.json({ interviewId: interview.id, review });
}
