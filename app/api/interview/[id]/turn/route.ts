import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamText, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck } from "@/lib/quota";
import { touchStreak } from "@/lib/streak";
import {
  interviewerSystemPrompt,
  transcriptPrompt,
} from "@/lib/prompts/interviewer";
import {
  CurriculumSchema,
  EvalSchema,
  EVAL_SENTINEL,
  END_MARKER,
} from "@/lib/schemas";

export const maxDuration = 60;

/**
 * The turn engine. One streaming Gemini call per turn produces both the
 * interviewer's next message AND a hidden eval of the previous answer
 * (separated by the EVAL sentinel). The visible part streams to the client;
 * the eval is parsed server-side and persisted on the candidate's turn.
 */
export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const answer =
    typeof body?.answer === "string" ? body.answer.trim().slice(0, 8000) : null;
  const speechMetrics =
    body?.speechMetrics && typeof body.speechMetrics === "object"
      ? body.speechMetrics
      : null;
  const hint = body?.hint === true;

  // Load the interview (RLS guarantees ownership).
  const { data: interview } = await supabase
    .from("interviews")
    .select(
      "id, status, role_track, round_type, difficulty, persona, jd_text, curriculum_id, curriculum_level"
    )
    .eq("id", interviewId)
    .maybeSingle();
  if (!interview) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (interview.status !== "active") {
    return NextResponse.json({ error: "interview ended" }, { status: 409 });
  }

  const { data: turns } = await supabase
    .from("turns")
    .select("idx, speaker, text")
    .eq("interview_id", interviewId)
    .order("idx", { ascending: true });
  const history = turns ?? [];
  const aiTurnCount = history.filter((t) => t.speaker === "ai").length;

  // First request opens the interview (no answer). Afterwards an answer is
  // required — unless the last turn is the candidate's (an AI reply was lost
  // mid-stream), in which case a bare request nudges the interviewer again.
  const lastSpeaker = history[history.length - 1]?.speaker;
  if (history.length > 0 && !answer && lastSpeaker !== "user" && !hint) {
    return NextResponse.json({ error: "answer required" }, { status: 400 });
  }

  // Every turn is exactly one Gemini call — guard the global budget.
  const blocked = await consumeQuota(supabase, [globalCheck()]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          "The app's free daily AI budget is spent. This interview is saved — resume it tomorrow.",
      },
      { status: 429 }
    );
  }

  // Persist the candidate's answer before generating.
  let userTurnIdx: number | null = null;
  if (answer) {
    userTurnIdx = history.length;
    const { error: userTurnError } = await supabase.from("turns").insert({
      interview_id: interviewId,
      idx: userTurnIdx,
      speaker: "user",
      text: answer,
      speech_metrics: speechMetrics,
    });
    if (userTurnError) {
      // Unique violation => double submit; reject.
      return NextResponse.json({ error: "duplicate turn" }, { status: 409 });
    }
    await touchStreak(supabase, user.id); // interviewing counts toward the streak
  }

  // Compose prompt context (all free DB lookups).
  const persona = (interview.persona ?? {}) as {
    interviewer_name?: string;
    question_count?: number;
    bar_raiser?: boolean;
    panel?: boolean;
    currency?: string;
    depth_topic?: string;
    repo_label?: string;
    repo_digest?: string;
  };

  let topicScope: { title: string; objective: string }[] | undefined;
  if (interview.curriculum_id != null && interview.curriculum_level != null) {
    const { data: cur } = await supabase
      .from("curricula")
      .select("structure")
      .eq("id", interview.curriculum_id)
      .maybeSingle();
    const parsed = CurriculumSchema.safeParse(cur?.structure);
    if (parsed.success) {
      const level = parsed.data.levels[interview.curriculum_level];
      topicScope = level?.modules.flatMap((m) =>
        m.topics.map((t) => ({ title: t.title, objective: t.objective }))
      );
    }
  }

  // Behavioral rounds pull in the candidate's own polished STAR stories.
  const storiesPromise =
    interview.round_type === "behavioral"
      ? supabase
          .from("stories")
          .select("title, polished_md")
          .eq("user_id", user.id)
          .not("polished_md", "is", null)
          .order("updated_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null });

  const [{ data: profile }, { data: fresh }, { data: storyRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("target_role, skills")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("knowledge_items")
        .select("title, summary")
        .order("fetched_at", { ascending: false })
        .limit(3),
      storiesPromise,
    ]);

  const stories = (storyRows ?? [])
    .filter((s) => s.polished_md)
    .map((s) => ({ title: s.title as string, polished: s.polished_md as string }));

  const system = interviewerSystemPrompt({
    roleTrack: interview.role_track,
    roundType: interview.round_type,
    difficulty: interview.difficulty,
    interviewerName: persona.interviewer_name ?? "Alex",
    questionCount: persona.question_count ?? 6,
    targetRole: profile?.target_role,
    jdText: interview.jd_text,
    skills: profile?.skills,
    topicScope,
    freshItems: fresh ?? undefined,
    stories: stories.length ? stories : undefined,
    barRaiser: persona.bar_raiser === true,
    panel: persona.panel === true,
    currency: persona.currency,
    depthTopic: persona.depth_topic ?? null,
    repo:
      persona.repo_digest && persona.repo_label
        ? { label: persona.repo_label, digest: persona.repo_digest }
        : null,
  });
  const prompt = transcriptPrompt(history, answer ?? undefined, hint);

  // Stream: forward visible text only; hold back the sentinel + eval JSON.
  const encoder = new TextEncoder();
  const aiTurnIdx = userTurnIdx !== null ? userTurnIdx + 1 : history.length;

  const generator = streamText({
    tier: "turn",
    system,
    prompt,
    mockKind: "turn",
    mockTurnIdx: aiTurnCount,
  });

  // Pull the first chunk before responding, so rate limits become a clean 429
  // instead of dying mid-stream.
  let firstChunk: IteratorResult<string>;
  try {
    firstChunk = await generator.next();
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    throw err;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let forwarded = 0;
      let sentinelHit = false;

      const forwardUpTo = (limit: number) => {
        if (limit > forwarded) {
          controller.enqueue(encoder.encode(full.slice(forwarded, limit)));
          forwarded = limit;
        }
      };

      const ingest = (chunk: string) => {
        full += chunk;
        if (sentinelHit) return; // keep consuming to capture the eval

        const sentinelAt = full.indexOf(EVAL_SENTINEL);
        if (sentinelAt !== -1) {
          forwardUpTo(sentinelAt);
          sentinelHit = true;
        } else {
          // Hold back enough characters that a split sentinel can't leak.
          forwardUpTo(Math.max(0, full.length - EVAL_SENTINEL.length));
        }
      };

      try {
        if (!firstChunk.done && firstChunk.value) ingest(firstChunk.value);
        for await (const chunk of generator) {
          ingest(chunk);
        }
        if (!sentinelHit) forwardUpTo(full.length);

        // ---- Post-stream: parse + persist ----
        const sentinelAt = full.indexOf(EVAL_SENTINEL);
        const visibleRaw =
          sentinelAt !== -1 ? full.slice(0, sentinelAt) : full;
        const evalRaw =
          sentinelAt !== -1
            ? full.slice(sentinelAt + EVAL_SENTINEL.length).trim()
            : "";

        const ended = visibleRaw.includes(END_MARKER);
        const visible = visibleRaw.replace(END_MARKER, "").trim();

        let evalJson: unknown = null;
        if (evalRaw && evalRaw !== "null") {
          try {
            const cleaned = evalRaw
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```$/, "");
            evalJson = EvalSchema.parse(JSON.parse(cleaned));
          } catch {
            evalJson = null; // malformed eval is non-fatal
          }
        }

        await supabase.from("turns").insert({
          interview_id: interviewId,
          idx: aiTurnIdx,
          speaker: "ai",
          text: visible,
        });

        if (evalJson && userTurnIdx !== null) {
          await supabase
            .from("turns")
            .update({ eval: evalJson })
            .eq("interview_id", interviewId)
            .eq("idx", userTurnIdx);
        }

        if (ended) {
          await supabase
            .from("interviews")
            .update({ status: "complete", ended_at: new Date().toISOString() })
            .eq("id", interviewId);
        }

        controller.close();
      } catch (err) {
        console.error("turn stream failed", err);
        try {
          controller.enqueue(
            encoder.encode(
              "\n[The interviewer lost their train of thought — please resend your answer.]"
            )
          );
          controller.close();
        } catch {
          /* controller already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
