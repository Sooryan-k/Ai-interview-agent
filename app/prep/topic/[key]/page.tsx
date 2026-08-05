import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { StudyContent } from "@/components/prep/StudyContent";
import { Badge } from "@/components/ui/badge";
import { CurriculumSchema } from "@/lib/schemas";
import { findTopic } from "@/lib/curriculum";

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { key: topicKey } = await params;
  const { c: curriculumId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!curriculumId) redirect("/prep");

  const { data: curriculumRow } = await supabase
    .from("curricula")
    .select("id, stack_label, structure")
    .eq("id", curriculumId)
    .maybeSingle();
  if (!curriculumRow) redirect("/prep");

  const parsed = CurriculumSchema.safeParse(curriculumRow.structure);
  const topicCtx = parsed.success
    ? findTopic(parsed.data, topicKey)
    : null;
  if (!topicCtx) redirect(`/prep?c=${curriculumId}`);

  // Cached material (may be null on first visit — client generates it).
  const { data: material } = await supabase
    .from("study_materials")
    .select("content_md, cheat_sheet_md, resources, interview_questions")
    .eq("curriculum_id", curriculumId)
    .eq("topic_key", topicKey)
    .maybeSingle();

  const { data: progress } = await supabase
    .from("user_track_progress")
    .select("topic_status")
    .eq("user_id", user.id)
    .eq("curriculum_id", curriculumId)
    .maybeSingle();
  const status =
    ((progress?.topic_status ?? {}) as Record<string, string>)[topicKey] ??
    "todo";

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{curriculumRow.stack_label}</span>
            <span>·</span>
            <span>{topicCtx.levelTitle}</span>
            <span>·</span>
            <span>{topicCtx.moduleTitle}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            {topicCtx.topic.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="shrink-0">
              ~{topicCtx.topic.est_minutes} min
            </Badge>
            <p className="text-sm text-muted-foreground">
              {topicCtx.topic.objective}
            </p>
          </div>
        </div>

        <StudyContent
          curriculumId={curriculumId}
          topicKey={topicKey}
          levelIdx={topicCtx.levelIdx}
          initialMaterial={material}
          initialStatus={status}
        />
      </main>
    </>
  );
}
