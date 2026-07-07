import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { Roadmap } from "@/components/prep/Roadmap";
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
      "curriculum_id, topic_status, current_level, curricula (id, stack_label, structure)"
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
        <main className="mx-auto w-full max-w-3xl px-6 py-12">
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

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Your prep path</p>
            <h1 className="text-3xl font-bold tracking-tight">
              {curriculumRow?.stack_label ?? structure.stack_label}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {masteredCount} of {allTopics.length} topics mastered ·{" "}
              {structure.levels.length} levels
            </p>
          </div>
          <div className="flex gap-2">
            {enrollments.length > 1 && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">All paths</Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/onboarding">+ New stack</Link>
            </Button>
          </div>
        </div>

        <Roadmap
          curriculumId={selected.curriculum_id}
          structure={structure}
          topicStatus={statusMap}
          currentLevel={selected.current_level ?? 0}
        />
      </main>
    </>
  );
}
