import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Brain, Plus } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { PageShell } from "@/components/PageShell";
import { Roadmap } from "@/components/prep/Roadmap";
import { PathSwitcher, type PathSummary } from "@/components/prep/PathSwitcher";
import { Button } from "@/components/ui/button";
import { CurriculumSchema } from "@/lib/schemas";

export default async function PrepPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollments } = await supabase
    .from("user_track_progress")
    .select(
      "curriculum_id, topic_status, quiz_scores, current_level, curricula (id, stack_label, structure)"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (!enrollments || enrollments.length === 0) redirect("/onboarding");

  const selected =
    (c && enrollments.find((e) => e.curriculum_id === c)) || enrollments[0];

  // Supabase types joined rows loosely; normalize to a single object.
  const curriculumRow = Array.isArray(selected.curricula)
    ? selected.curricula[0]
    : selected.curricula;

  const parsed = CurriculumSchema.safeParse(curriculumRow?.structure);
  if (!parsed.success) {
    return (
      <>
        <AppNav />
        <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <p className="text-sm text-muted-foreground">
            This curriculum looks corrupted. Please create a new one from{" "}
            <Link className="underline" href="/onboarding">
              onboarding
            </Link>
            .
          </p>
        </main>
      </>
    );
  }

  const structure = parsed.data;
  const allTopics = structure.levels.flatMap((l) =>
    l.modules.flatMap((m) => m.topics)
  );
  const statusMap = (selected.topic_status ?? {}) as Record<
    string,
    "todo" | "learning" | "mastered"
  >;
  const masteredCount = allTopics.filter(
    (t) => statusMap[t.key] === "mastered"
  ).length;

  // Every path the user has, for the switcher. Progress is counted the same
  // way as the headline above, so the tab and the page can't disagree.
  const paths: PathSummary[] = enrollments.map((e) => {
    const row = Array.isArray(e.curricula) ? e.curricula[0] : e.curricula;
    const shape = CurriculumSchema.safeParse(row?.structure);
    const topics = shape.success
      ? shape.data.levels.flatMap((l) => l.modules.flatMap((m) => m.topics))
      : [];
    const status = (e.topic_status ?? {}) as Record<string, string>;
    return {
      curriculumId: e.curriculum_id,
      label: row?.stack_label ?? "Untitled path",
      mastered: topics.filter((t) => status[t.key] === "mastered").length,
      total: topics.length,
    };
  });

  return (
    <>
      <AppNav />
      <PageShell
        title={curriculumRow?.stack_label ?? structure.stack_label}
        description={`${masteredCount} of ${allTopics.length} topics mastered · ${structure.levels.length} levels`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link href={`/prep/cram?c=${selected.curriculum_id}`}>
                  <Brain data-icon="inline-start" /> Cram sheet
                </Link>
              }
            />
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href="/onboarding">
                  <Plus data-icon="inline-start" /> New stack
                </Link>
              }
            />
          </>
        }
      >
        <PathSwitcher paths={paths} currentId={selected.curriculum_id} />

        <Roadmap
          curriculumId={selected.curriculum_id}
          structure={structure}
          topicStatus={statusMap}
          currentLevel={selected.current_level ?? 0}
          quizScores={
            (selected.quiz_scores ?? {}) as Record<string, { pct: number }>
          }
        />
      </PageShell>
    </>
  );
}
