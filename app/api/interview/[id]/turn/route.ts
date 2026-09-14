import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamText, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck } from "@/lib/quota";
import { touchStreak } from "@/lib/streak";
import { suggestRoleFromStacks } from "@/lib/roles";
import { stackName, stackNames } from "@/lib/stacks";
import {
  interviewerSystemPrompt,
  transcriptPrompt,
} from "@/lib/prompts/interviewer";
import {
  CurriculumSchema,
  EVAL_SENTINEL,
  END_MARKER,
  parseTurnMeta,
} from "@/lib/schemas";
import { detectNonAnswer, resolveEval } from "@/lib/scoring";
import { stackForQuestion, type QuestionPlan } from "@/lib/interview-plan";
import {
  buildExclusions,
  exclusionPromptSection,
  findDuplicate,
  questionSignature,
  type HistoryEntry,
} from "@/lib/question-history";

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
  const reveal = body?.reveal === true;
  const wrapUp = body?.wrapUp === true;

  // Load the interview (RLS guarantees ownership).
  const { data: interview } = await supabase
    .from("interviews")
    .select(
      "id, status, role_track, round_type, difficulty, persona, jd_text, curriculum_id, curriculum_level, planned_questions, stack_ids, question_plan"
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
  if (
    history.length > 0 &&
    !answer &&
    lastSpeaker !== "user" &&
    !hint &&
    !reveal &&
    !wrapUp
  ) {
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

  // Whether the candidate actually answered is decided here, from their words,
  // before the model ever sees them. Everything downstream — the score, the
  // follow-up, the report tally — hangs off this rather than off the model's
  // willingness to call a non-answer a non-answer.
  const nonAnswer = answer ? detectNonAnswer(answer) : { isNonAnswer: false };

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
        .select(
          "target_role, skills, role_id, role_other, stack_ids, primary_stack_id"
        )
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

  // ---- The plan, and where in it we are ----
  const plannedQuestions =
    interview.planned_questions ?? persona.question_count ?? 12;
  const plan = (interview.question_plan as QuestionPlan | null) ?? null;
  const interviewStacks: string[] = interview.stack_ids ?? [];
  // aiTurnCount interviewer messages have gone out, so the next one is
  // question number aiTurnCount + 1.
  const questionNumber = aiTurnCount + 1;
  const nextStackId = stackForQuestion(plan, aiTurnCount);

  // ---- What they've already been asked, across every previous interview ----
  let exclusions = "";
  let stackHistory: HistoryEntry[] = [];
  if (interviewStacks.length > 0) {
    const { data: past } = await supabase
      .from("question_history")
      .select("question, signature, topic, stack_id, difficulty, asked_at")
      .eq("user_id", user.id)
      .in("stack_id", interviewStacks)
      .order("asked_at", { ascending: false })
      .limit(400);
    stackHistory = past ?? [];
    exclusions = exclusionPromptSection(
      buildExclusions(stackHistory, interviewStacks, (id) => stackName(id) ?? id)
    );
  }

  const system = interviewerSystemPrompt({
    roleTrack: interview.role_track,
    roundType: interview.round_type,
    difficulty: interview.difficulty,
    interviewerName: persona.interviewer_name ?? "Aarav",
    questionCount: plannedQuestions,
    plan,
    questionNumber,
    exclusions,
    targetRole: profile?.target_role,
    // Falls back to a guess from their stacks when they haven't confirmed a
    // role yet — framing only, never written back to the profile.
    roleId:
      profile?.role_id ?? suggestRoleFromStacks(profile?.stack_ids ?? []),
    roleOther: profile?.role_other,
    stacks: stackNames(profile?.stack_ids ?? []),
    primaryStack: profile?.primary_stack_id
      ? stackName(profile.primary_stack_id)
      : null,
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
  // Hard stop. The model can't reliably count its own questions once hints and
  // reveals are in the mix, so once the planned number of interviewer turns is
  // used up, this turn becomes the sign-off no matter what was requested —
  // otherwise repeatedly clicking "show me the answer" runs on forever.
  const mustClose = aiTurnCount >= plannedQuestions;
  const closing = wrapUp || mustClose;

  const prompt = transcriptPrompt(history, answer ?? undefined, {
    hint: hint && !closing,
    reveal: reveal && !closing,
    wrapUp: closing,
    wrapUpReason: wrapUp ? "early" : "complete",
    nonAnswer: nonAnswer.isNonAnswer && !closing,
    questionNumber: closing ? undefined : questionNumber,
    questionCount: closing ? undefined : plannedQuestions,
    nextStack: nextStackId ? stackName(nextStackId) : null,
  });

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

        // WHO ENDS THE INTERVIEW.
        //
        // Only two things end a round: the candidate choosing to stop, or the
        // planned questions running out. Both are `closing`, decided above from
        // stored state before the model was even called.
        //
        // An END_MARKER in the model's output is deliberately ignored for every
        // round except a depth ladder — the model drifts into "that's all we
        // have time for" after a few weak answers, which is exactly how a
        // 12-question interview used to stop at 4. The marker is stripped from
        // the text either way so the candidate never sees a goodbye that isn't.
        //
        // Depth ladders are the one exception: stopping the moment it finds the
        // ceiling is that round's entire purpose, not a malfunction.
        const modelWantsEnd = visibleRaw.includes(END_MARKER);
        const ladderCeiling =
          interview.round_type === "depth" && modelWantsEnd && !reveal;
        const ended = closing || ladderCeiling;
        if (modelWantsEnd && !ended) {
          console.warn(
            `[turn] ignored an unplanned end marker at question ${questionNumber}/${plannedQuestions} on interview ${interviewId}`
          );
        }
        const visible = visibleRaw.split(END_MARKER).join("").trim();

        const meta = parseTurnMeta(evalRaw);

        await supabase.from("turns").insert({
          interview_id: interviewId,
          idx: aiTurnIdx,
          speaker: "ai",
          text: visible,
        });

        // ---- Score of record ----
        // resolveEval reads the candidate's actual words; a non-answer is a
        // zero here regardless of what the model proposed.
        if (userTurnIdx !== null && answer) {
          const resolved = resolveEval(answer, meta.eval);
          await supabase
            .from("turns")
            .update({
              eval: {
                score: resolved.score,
                verdict: resolved.verdict,
                criteria: resolved.criteria,
                note: resolved.note,
                model_answer: resolved.model_answer,
                tags: resolved.tags,
                ...(resolved.depth !== undefined
                  ? { depth: resolved.depth }
                  : {}),
              },
            })
            .eq("interview_id", interviewId)
            .eq("idx", userTurnIdx);
        }

        // ---- Remember what was asked, so the next interview can avoid it ----
        if (!ended && meta.question?.text?.trim()) {
          const questionText = meta.question.text.trim();
          // The model is told which technology to cover; trust the plan over
          // its self-report when the two disagree.
          const stackId =
            nextStackId ??
            (meta.question.stack && interviewStacks.includes(meta.question.stack)
              ? meta.question.stack
              : interviewStacks[0] ?? null);

          if (stackId) {
            const repeat = findDuplicate(
              questionText,
              stackHistory.filter((h) => h.stack_id === stackId),
              { context: [stackName(stackId) ?? stackId, stackId] }
            );
            if (repeat) {
              // Recorded anyway — it was genuinely asked, and leaving it out
              // would let the same question come back a third time.
              console.warn(
                `[turn] repeat question on ${stackId}: "${questionText}" ~ "${repeat.question}"`
              );
            }
            await supabase.from("question_history").insert({
              user_id: user.id,
              interview_id: interviewId,
              stack_id: stackId,
              topic: meta.question.topic?.slice(0, 120) ?? "",
              difficulty: meta.question.difficulty || interview.difficulty,
              question: questionText.slice(0, 1000),
              signature: questionSignature(questionText),
            });
          }
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
