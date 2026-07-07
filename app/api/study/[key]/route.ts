import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck, userStudyCheck } from "@/lib/quota";
import { studyPrompt } from "@/lib/prompts/study";
import { CurriculumSchema, StudyMaterialSchema } from "@/lib/schemas";
import { findTopic } from "@/lib/curriculum";

export const maxDuration = 60;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key: topicKey } = await ctx.params;
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

  // 1. Cache hit? (readable by any signed-in user)
  const { data: cached } = await supabase
    .from("study_materials")
    .select("content_md, cheat_sheet_md, resources, interview_questions, topic_title")
    .eq("curriculum_id", curriculumId)
    .eq("topic_key", topicKey)
    .maybeSingle();
  if (cached) return NextResponse.json({ material: cached, cached: true });

  // 2. Validate the topic exists in this curriculum.
  const { data: curriculumRow } = await supabase
    .from("curricula")
    .select("stack_label, structure")
    .eq("id", curriculumId)
    .maybeSingle();
  if (!curriculumRow) {
    return NextResponse.json({ error: "curriculum not found" }, { status: 404 });
  }
  const parsedCurriculum = CurriculumSchema.safeParse(curriculumRow.structure);
  const topicCtx = parsedCurriculum.success
    ? findTopic(parsedCurriculum.data, topicKey)
    : null;
  if (!topicCtx) {
    return NextResponse.json({ error: "topic not found" }, { status: 404 });
  }

  // 3. Quota, then generate.
  const blocked = await consumeQuota(supabase, [
    globalCheck(),
    userStudyCheck(user.id),
  ]);
  if (blocked) {
    const message = blocked.startsWith("user:")
      ? "You've hit today's limit for new study topics. Review what you've unlocked, or come back tomorrow."
      : "The app's free daily AI budget is spent — cached topics are still available.";
    return NextResponse.json({ error: "quota", message }, { status: 429 });
  }

  // Pull a few fresh knowledge items for the resources block (free lookup).
  const { data: fresh } = await supabase
    .from("knowledge_items")
    .select("title, url, summary")
    .order("fetched_at", { ascending: false })
    .limit(3);

  let material;
  try {
    const raw = await generateText({
      tier: "turn",
      prompt: studyPrompt({
        stackLabel: curriculumRow.stack_label,
        levelTitle: topicCtx.levelTitle,
        topicTitle: topicCtx.topic.title,
        objective: topicCtx.topic.objective,
        freshItems: fresh ?? undefined,
      }),
      json: true,
      mockKind: "study",
    });
    material = StudyMaterialSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("study generation failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // 4. Persist to the global cache (service role; tolerate races).
  const admin = createAdminClient();
  const row = {
    curriculum_id: curriculumId,
    topic_key: topicKey,
    topic_title: topicCtx.topic.title,
    content_md: material.content_md,
    cheat_sheet_md: material.cheat_sheet_md,
    resources: material.resources,
    interview_questions: material.interview_questions,
  };
  const { error: insertError } = await admin
    .from("study_materials")
    .insert(row);
  if (insertError) {
    const { data: existing } = await supabase
      .from("study_materials")
      .select("content_md, cheat_sheet_md, resources, interview_questions, topic_title")
      .eq("curriculum_id", curriculumId)
      .eq("topic_key", topicKey)
      .maybeSingle();
    if (existing) return NextResponse.json({ material: existing, cached: true });
    console.error("study insert failed", insertError);
  }

  return NextResponse.json({ material: row, cached: false });
}
