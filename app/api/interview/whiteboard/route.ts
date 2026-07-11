import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import {
  consumeQuota,
  globalCheck,
  userInterviewCheck,
} from "@/lib/quota";
import { whiteboardPrompt } from "@/lib/prompts/whiteboard";
import { WhiteboardCritiqueSchema } from "@/lib/schemas";
import { touchStreak } from "@/lib/streak";

export const maxDuration = 60;

/**
 * System-design whiteboard round. Accepts a PNG (base64) of the candidate's
 * Excalidraw diagram + the prompt, sends ONE vision call, and persists the
 * critique as an interview + report. Counts against the interview daily cap.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
  let imageData = typeof body?.image === "string" ? body.image : "";
  // Accept a data URL or a bare base64 string.
  const comma = imageData.indexOf(",");
  if (imageData.startsWith("data:") && comma !== -1) {
    imageData = imageData.slice(comma + 1);
  }
  if (!question || imageData.length < 100) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  // Guard payload size (base64 ~1.33x bytes) — keep well under model limits.
  if (imageData.length > 6_000_000) {
    return NextResponse.json(
      { error: "too_large", message: "Diagram image is too large — simplify it." },
      { status: 413 }
    );
  }

  const blocked = await consumeQuota(supabase, [
    userInterviewCheck(user.id),
    globalCheck(),
  ]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          blocked === "global"
            ? "The free daily AI budget is spent — try again tomorrow."
            : "You've used today's free interview rounds — come back tomorrow.",
      },
      { status: 429 }
    );
  }

  let critique;
  try {
    const raw = await generateText({
      tier: "turn", // flash-lite supports image input on the free tier
      prompt: whiteboardPrompt(question),
      image: { data: imageData, mimeType: "image/png" },
      json: true,
      mockKind: "whiteboard",
    });
    critique = WhiteboardCritiqueSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("whiteboard critique failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // Persist as an interview + report so it shows up in history/analytics.
  const { data: interview, error: ivError } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      role_track: "System Design",
      round_type: "system_design",
      difficulty: "medium",
      persona: { mode: "whiteboard", question },
      status: "complete",
      ended_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (ivError || !interview) {
    console.error("whiteboard interview insert failed", ivError);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  await supabase.from("reports").insert({
    interview_id: interview.id,
    user_id: user.id,
    overall_score: Math.round(critique.overall_score),
    strengths: critique.strengths,
    weaknesses: [...critique.bottlenecks, ...critique.missing_pieces],
    per_question: [
      {
        q: question,
        answer_summary: `Diagram components: ${critique.components_identified.join(", ") || "—"}`,
        model_answer: critique.verdict,
        score: Math.round(critique.overall_score / 10),
      },
    ],
    recommendations: critique.follow_up_questions,
  });

  await touchStreak(supabase, user.id);

  return NextResponse.json({ interviewId: interview.id, critique });
}
