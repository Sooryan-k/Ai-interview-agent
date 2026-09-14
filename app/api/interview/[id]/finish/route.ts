import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck } from "@/lib/quota";
import { reportPrompt } from "@/lib/prompts/report";
import { ReportSchema, type TurnEval } from "@/lib/schemas";
import { overallScoreFromEvals, tallyEvals } from "@/lib/scoring";

export const maxDuration = 60;

interface PerQuestion {
  q: string;
  answer_summary: string;
  model_answer: string;
  score: number;
  verdict?: string;
}

/**
 * Zips the model's per-question prose onto the scores of record.
 *
 * The evals are authoritative and ordered, so they decide how many entries
 * there are and what each one scored; the model only supplies the wording. An
 * unanswered question keeps the model_answer captured at the time, which is
 * the thing the candidate most needs to read.
 */
function mergePerQuestion(
  fromModel: PerQuestion[],
  evals: TurnEval[]
): PerQuestion[] {
  return evals.map((e, i) => {
    const m = fromModel[i];
    const unanswered = e.verdict === "unanswered";
    return {
      q: m?.q ?? `Question ${i + 1}`,
      answer_summary: unanswered
        ? "Not answered."
        : (m?.answer_summary ?? e.note ?? ""),
      model_answer: e.model_answer?.trim() || m?.model_answer || "",
      score: e.score,
      ...(e.verdict ? { verdict: e.verdict } : {}),
    };
  });
}

/** Generates the end-of-interview report card (one 'smart' Gemini call). Idempotent. */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, status, role_track, round_type, difficulty, planned_questions")
    .eq("id", interviewId)
    .maybeSingle();
  if (!interview) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Idempotent: an existing report is simply returned.
  const { data: existing } = await supabase
    .from("reports")
    .select("interview_id")
    .eq("interview_id", interviewId)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true });

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text, eval")
    .eq("interview_id", interviewId)
    .order("idx", { ascending: true });

  // Questions actually put to the candidate. The final interviewer message is
  // the sign-off, not a question, so it doesn't count.
  const aiTurns = (turns ?? []).filter((t) => t.speaker === "ai").length;
  const askedQuestions = Math.max(0, aiTurns - 1);

  if (!turns || turns.length < 2) {
    return NextResponse.json(
      { error: "too_short", message: "Answer at least one question first." },
      { status: 400 }
    );
  }

  const blocked = await consumeQuota(supabase, [globalCheck()]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          "The free daily AI budget is spent — your transcript is saved, generate the report tomorrow.",
      },
      { status: 429 }
    );
  }

  let report;
  try {
    const raw = await generateText({
      tier: "smart",
      prompt: reportPrompt({
        roleTrack: interview.role_track,
        roundType: interview.round_type,
        difficulty: interview.difficulty,
        turns,
      }),
      json: true,
      mockKind: "report",
    });
    report = ReportSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("report generation failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // ---- The numbers come from the transcript, not from the model ----
  //
  // The model writes the prose. Every score in the report is the one that was
  // computed when the answer was given, and the headline is their mean — so a
  // report can't be more flattering than the round it describes.
  const evals = turns
    .filter((t) => t.speaker === "user" && t.eval)
    .map((t) => t.eval as TurnEval);

  const perQuestion = mergePerQuestion(report.per_question, evals);
  const overallScore = overallScoreFromEvals(evals);
  const tally = tallyEvals(evals, Math.max(askedQuestions, evals.length));

  const { error: insertError } = await supabase.from("reports").insert({
    interview_id: interviewId,
    user_id: user.id,
    overall_score: overallScore,
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    per_question: perQuestion,
    recommendations: report.recommendations,
    tally,
  });
  if (insertError && insertError.code !== "23505") {
    console.error("report insert failed", insertError);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  if (interview.status === "active") {
    await supabase
      .from("interviews")
      .update({ status: "complete", ended_at: new Date().toISOString() })
      .eq("id", interviewId);
  }

  return NextResponse.json({ ok: true });
}
