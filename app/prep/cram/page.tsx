import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { Markdown } from "@/components/Markdown";
import { CurriculumSchema } from "@/lib/schemas";

/**
 * Cheat-sheet cram mode: a single distraction-free, printable page that
 * concatenates the cheat sheets of the topics you've studied. Zero AI cost —
 * pulls only already-generated study_materials. Great pre-interview ritual.
 */
export default async function CramPage({
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
    .select("curriculum_id, curricula (id, stack_label, structure)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (!enrollments || enrollments.length === 0) redirect("/onboarding");

  const selected =
    (c && enrollments.find((e) => e.curriculum_id === c)) || enrollments[0];
  const cur = Array.isArray(selected.curricula)
    ? selected.curricula[0]
    : selected.curricula;
  const parsed = CurriculumSchema.safeParse(cur?.structure);

  // Cheat sheets for this curriculum's topics that have been generated.
  const { data: materials } = await supabase
    .from("study_materials")
    .select("topic_key, topic_title, cheat_sheet_md")
    .eq("curriculum_id", selected.curriculum_id)
    .not("cheat_sheet_md", "is", null);

  const sheets = (materials ?? []).filter(
    (m) => (m.cheat_sheet_md ?? "").trim().length > 0
  );

  // Order sheets by their position in the curriculum for a logical flow.
  const order = new Map<string, number>();
  if (parsed.success) {
    let i = 0;
    for (const level of parsed.data.levels)
      for (const mod of level.modules)
        for (const t of mod.topics) order.set(t.key, i++);
  }
  sheets.sort(
    (a, b) => (order.get(a.topic_key) ?? 999) - (order.get(b.topic_key) ?? 999)
  );

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="print-hidden mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cram sheet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every cheat sheet you&apos;ve unlocked for{" "}
              {cur?.stack_label ?? "your path"}, on one page. Skim it right
              before you walk in.
            </p>
          </div>
        </div>

        {sheets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No cheat sheets yet — open a few topics in your{" "}
            <Link href={`/prep?c=${selected.curriculum_id}`} className="underline">
              prep path
            </Link>{" "}
            to generate them, then come back to cram.
          </p>
        ) : (
          <div className="space-y-8">
            {sheets.map((s) => (
              <section key={s.topic_key}>
                <h2 className="mb-2 border-b pb-1 text-lg font-semibold">
                  {s.topic_title ?? s.topic_key}
                </h2>
                <Markdown>{s.cheat_sheet_md ?? ""}</Markdown>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
