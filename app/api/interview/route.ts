import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeQuota, userInterviewCheck } from "@/lib/quota";
import { CurriculumSchema } from "@/lib/schemas";
import { DEFAULT_CURRENCY, isCurrencyCode } from "@/lib/currency";
import { GitHubError, buildRepoDigest, parseRepoRef } from "@/lib/github";
import { isStackId, resolveStackList, MAX_STACKS } from "@/lib/stacks";
import {
  buildQuestionPlan,
  plannedQuestionsFor,
  STACK_DRIVEN_ROUNDS,
} from "@/lib/interview-plan";

const ROUND_TYPES = new Set([
  "behavioral",
  "technical",
  "system_design",
  "dsa",
  "hr",
  "negotiation",
  "depth",
  "repo",
]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const INTERVIEWER_NAMES = [
  "Aarav",
  "Priya",
  "Rohan",
  "Ananya",
  "Vikram",
  "Meera",
];

// Fetching a repo tree + several files can take a few seconds.
export const maxDuration = 60;

/** Creates an interview and returns its id. Consumes 1 interview from the user's daily cap. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roundType = ROUND_TYPES.has(body?.roundType)
    ? (body.roundType as string)
    : "technical";
  const difficulty = DIFFICULTIES.has(body?.difficulty)
    ? (body.difficulty as string)
    : "medium";
  const curriculumId =
    typeof body?.curriculumId === "string" ? body.curriculumId : null;
  const level = Number.isInteger(body?.level) ? (body.level as number) : null;
  const jdText =
    typeof body?.jdText === "string" ? body.jdText.slice(0, 4000) : null;
  const barRaiser = body?.barRaiser === true;
  const panel = body?.panel === true;
  const currency = isCurrencyCode(body?.currency)
    ? body.currency
    : DEFAULT_CURRENCY;
  const depthTopic =
    typeof body?.depthTopic === "string" && body.depthTopic.trim()
      ? body.depthTopic.trim().slice(0, 120)
      : null;
  const repoUrl =
    typeof body?.repoUrl === "string" ? body.repoUrl.trim().slice(0, 300) : "";
  // Roomy enough for the picker's six official names joined with " + "; a hard
  // truncation here would leave a half-written technology name in the report.
  let roleTrack =
    typeof body?.roleTrack === "string" && body.roleTrack.trim()
      ? body.roleTrack.trim().slice(0, 160)
      : "";

  // If launched from a curriculum, derive the role track and validate the level.
  let curriculumLevel: number | null = null;
  if (curriculumId) {
    const { data: cur } = await supabase
      .from("curricula")
      .select("stack_label, structure")
      .eq("id", curriculumId)
      .maybeSingle();
    if (!cur) {
      return NextResponse.json({ error: "curriculum not found" }, { status: 404 });
    }
    if (!roleTrack) roleTrack = cur.stack_label;
    const parsed = CurriculumSchema.safeParse(cur.structure);
    if (parsed.success && level !== null && parsed.data.levels[level]) {
      curriculumLevel = level;
    }
  }
  if (!roleTrack) {
    return NextResponse.json({ error: "roleTrack required" }, { status: 400 });
  }

  // Which technologies this round covers. The client sends the ids it picked;
  // anything unrecognised is dropped rather than trusted, and a client that
  // sends none at all falls back to reading them out of the label.
  const requestedStacks = Array.isArray(body?.stackIds)
    ? (body.stackIds as unknown[])
        .filter((id): id is string => typeof id === "string" && isStackId(id))
        .slice(0, MAX_STACKS)
    : [];
  const stackIds =
    requestedStacks.length > 0
      ? [...new Set(requestedStacks)]
      : resolveStackList(roleTrack).ids.slice(0, MAX_STACKS);

  // The length of the interview is decided here, once, and stored on the
  // session. Nothing downstream recomputes it and the model is never asked to
  // keep count.
  const plannedQuestions = plannedQuestionsFor({
    roundType,
    difficulty,
    stackIds,
  });
  const questionPlan =
    STACK_DRIVEN_ROUNDS.has(roundType) && stackIds.length > 0
      ? buildQuestionPlan(stackIds)
      : null;

  // Build the repo digest BEFORE consuming quota — a bad URL or a GitHub
  // hiccup shouldn't cost the user one of their daily interviews.
  let repo: { label: string; digest: string; truncated: boolean } | null = null;
  if (roundType === "repo") {
    const ref = parseRepoRef(repoUrl);
    if (!ref) {
      return NextResponse.json(
        {
          error: "bad_repo",
          message:
            "That doesn't look like a GitHub repo. Use a link like https://github.com/owner/name.",
        },
        { status: 400 }
      );
    }
    try {
      const built = await buildRepoDigest(ref);
      repo = {
        label: built.label,
        digest: built.digest,
        truncated: built.truncated,
      };
    } catch (err) {
      if (err instanceof GitHubError) {
        return NextResponse.json(
          { error: "bad_repo", message: err.message },
          { status: err.status === 404 ? 404 : 502 }
        );
      }
      console.error("repo digest failed", err);
      return NextResponse.json(
        {
          error: "bad_repo",
          message: "Couldn't read that repository — try again shortly.",
        },
        { status: 502 }
      );
    }
  }

  const blocked = await consumeQuota(supabase, [userInterviewCheck(user.id)]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          "You've used today's free mock interviews. Practice Mode and your study path are still open — come back tomorrow for more rounds.",
      },
      { status: 429 }
    );
  }

  const persona = {
    interviewer_name:
      INTERVIEWER_NAMES[Math.floor(Math.random() * INTERVIEWER_NAMES.length)],
    // Kept in sync with the column for older clients reading persona.
    question_count: plannedQuestions,
    bar_raiser: barRaiser,
    panel,
    ...(roundType === "negotiation" ? { currency } : {}),
    ...(roundType === "depth" && depthTopic ? { depth_topic: depthTopic } : {}),
    ...(repo
      ? {
          repo_label: repo.label,
          repo_digest: repo.digest,
          repo_truncated: repo.truncated,
        }
      : {}),
  };

  const { data: interview, error } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      curriculum_id: curriculumId,
      curriculum_level: curriculumLevel,
      role_track: roleTrack,
      round_type: roundType,
      difficulty,
      persona,
      jd_text: jdText,
      planned_questions: plannedQuestions,
      stack_ids: stackIds,
      question_plan: questionPlan,
    })
    .select("id")
    .single();

  if (error || !interview) {
    console.error("interview insert failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ interviewId: interview.id });
}
