import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { Quiz } from "@/components/prep/Quiz";
import { CurriculumSchema } from "@/lib/schemas";
import { findModule } from "@/lib/curriculum";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { key: moduleKey } = await params;
  const { c: curriculumId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!curriculumId) redirect("/prep");

  const { data: curriculumRow } = await supabase
    .from("curricula")
    .select("stack_label, structure")
    .eq("id", curriculumId)
    .maybeSingle();
  const parsed = CurriculumSchema.safeParse(curriculumRow?.structure);
  const mod = parsed.success ? findModule(parsed.data, moduleKey) : null;
  if (!mod) redirect(`/prep?c=${curriculumId}`);

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <Link
            href={`/prep?c=${curriculumId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {curriculumRow?.stack_label} roadmap
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Checkpoint: {mod.moduleTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mod.levelTitle} · pass this to prove the module stuck. No AI cost
            after the first generation — retake as often as you like.
          </p>
        </div>
        <Quiz
          curriculumId={curriculumId}
          moduleKey={moduleKey}
          moduleTitle={mod.moduleTitle}
        />
      </main>
    </>
  );
}
