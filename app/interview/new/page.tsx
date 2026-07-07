import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { NewInterviewForm } from "@/components/interview/NewInterviewForm";
import { CurriculumSchema } from "@/lib/schemas";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; level?: string }>;
}) {
  const { c: curriculumId, level: levelParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let defaultRoleTrack = "";
  let levelTitle: string | undefined;
  let level: number | undefined;

  if (curriculumId) {
    const { data: cur } = await supabase
      .from("curricula")
      .select("stack_label, structure")
      .eq("id", curriculumId)
      .maybeSingle();
    if (cur) {
      defaultRoleTrack = cur.stack_label;
      const parsedLevel = Number.parseInt(levelParam ?? "", 10);
      const parsed = CurriculumSchema.safeParse(cur.structure);
      if (
        parsed.success &&
        Number.isInteger(parsedLevel) &&
        parsed.data.levels[parsedLevel]
      ) {
        level = parsedLevel;
        levelTitle = parsed.data.levels[parsedLevel].title;
      }
    }
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("target_role")
      .eq("id", user.id)
      .maybeSingle();
    defaultRoleTrack = profile?.target_role ?? "";
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <NewInterviewForm
          defaultRoleTrack={defaultRoleTrack}
          curriculumId={curriculumId}
          level={level}
          levelTitle={levelTitle}
        />
      </main>
    </>
  );
}
