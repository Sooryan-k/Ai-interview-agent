import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck } from "@/lib/quota";
import { reportPrompt } from "@/lib/prompts/report";
import { ReportSchema } from "@/lib/schemas";

export const maxDuration = 60;

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
    .select("id, status, role_track, round_type, difficulty")
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

  const { error: insertError } = await supabase.from("reports").insert({
    interview_id: interviewId,
    user_id: user.id,
    overall_score: Math.round(report.overall_score),
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    per_question: report.per_question,
    recommendations: report.recommendations,
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
