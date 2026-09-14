import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Code2, PenTool } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { NewInterviewForm } from "@/components/interview/NewInterviewForm";
import { CurriculumSchema } from "@/lib/schemas";
import { resolveStackList } from "@/lib/stacks";

export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; level?: string; round?: string }>;
}) {
  const {
    c: curriculumId,
    level: levelParam,
    round: roundParam,
  } = await searchParams;
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
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("target_role, role_id, stack_ids, primary_stack_id")
    .eq("id", user.id)
    .maybeSingle();

  const stackIds: string[] = profile?.stack_ids ?? [];

  // What the stack field starts with. A curriculum-scoped round inherits that
  // path's label (resolved back to catalog ids so it renders as chips); a plain
  // round starts on their primary technology, which they can change or add to.
  let defaultStackIds: string[] = [];
  let defaultCustom = "";
  if (defaultRoleTrack) {
    const { ids } = resolveStackList(defaultRoleTrack);
    defaultStackIds = ids;
    // Keep the original wording only when nothing in it was recognised, so a
    // label like "React + Node.js (Full-Stack)" doesn't drag its role suffix in.
    if (ids.length === 0) defaultCustom = defaultRoleTrack;
  } else if (profile?.primary_stack_id) {
    defaultStackIds = [profile.primary_stack_id];
  } else if (stackIds.length > 0) {
    defaultStackIds = [stackIds[0]];
  } else if (profile?.target_role) {
    defaultCustom = profile.target_role;
  }

  // Empty state: an interview needs something to be about.
  const needsSetup = stackIds.length === 0 || !profile?.role_id;

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-2xl space-y-4 px-4 sm:px-6 py-10">
        {needsSetup && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              {stackIds.length === 0
                ? "Choose your tech stack first"
                : "Set your target role first"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {stackIds.length === 0
                ? "The interviewer needs to know which technologies to ask about."
                : "Your role decides the scenarios and the mix of coding, design and behavioural questions."}
            </p>
            <Button
              size="sm"
              className="mt-3"
              render={<Link href="/settings">Set this up</Link>}
            />
          </div>
        )}
        <NewInterviewForm
          defaultStackIds={defaultStackIds}
          defaultCustom={defaultCustom}
          suggestedStackIds={stackIds}
          primaryStackId={profile?.primary_stack_id}
          roleId={profile?.role_id}
          curriculumId={curriculumId}
          level={level}
          levelTitle={levelTitle}
          defaultRoundType={roundParam}
        />

        {/* Special rounds */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/interview/whiteboard"
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <PenTool className="size-4 text-primary" /> Whiteboard round
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Draw a system design; AI grades your actual diagram.
            </p>
          </Link>
          <Link
            href="/interview/coding"
            className="rounded-lg border p-4 transition-colors hover:bg-accent"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="size-4 text-primary" /> Coding round
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Solve in a real editor, run tests, get an AI code review.
            </p>
          </Link>
        </div>
      </main>
    </>
  );
}
