import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { PageShell } from "@/components/PageShell";
import { BankSeeder } from "@/components/prep/BankSeeder";
import { AddToPractice } from "@/components/prep/AddToPractice";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { stackName } from "@/lib/stacks";

const ROUNDS = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "system_design", label: "System design" },
  { value: "dsa", label: "DSA" },
  { value: "hr", label: "HR" },
] as const;
const DIFFS = ["easy", "medium", "hard"] as const;

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string; diff?: string; stack?: string }>;
}) {
  const sp = await searchParams;
  const round = ROUNDS.some((r) => r.value === sp.round)
    ? (sp.round as string)
    : "technical";
  const diff = (DIFFS as readonly string[]).includes(sp.diff ?? "")
    ? (sp.diff as string)
    : "medium";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Every technology the user has, not just the most recently touched path.
  // Sorting by updated_at and taking the first meant the bank silently showed
  // one stack, and which one changed as they studied.
  const { data: profile } = await supabase
    .from("profiles")
    .select("stack_ids, primary_stack_id")
    .eq("id", user.id)
    .maybeSingle();

  const stackTabs = (profile?.stack_ids ?? [])
    .map((id: string) => ({ id, label: stackName(id) ?? id }))
    .filter((t: { label: string }) => Boolean(t.label));

  // Fall back to the prep paths for users who predate the stack catalog.
  if (stackTabs.length === 0) {
    const { data: enrollments } = await supabase
      .from("user_track_progress")
      .select("curricula (stack_label)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    for (const e of enrollments ?? []) {
      const cur = Array.isArray(e.curricula) ? e.curricula[0] : e.curricula;
      if (cur?.stack_label) {
        stackTabs.push({ id: cur.stack_label, label: cur.stack_label });
      }
    }
  }

  const activeStack =
    stackTabs.find((t: { id: string }) => t.id === sp.stack) ??
    stackTabs.find(
      (t: { id: string }) => t.id === profile?.primary_stack_id
    ) ??
    stackTabs[0];
  const roleTrack = activeStack?.label ?? "Software Engineering";

  const { data: questions } = await supabase
    .from("question_bank")
    .select("id, question, ideal_points, tags, source")
    .eq("role_track", roleTrack)
    .eq("round_type", round)
    .eq("difficulty", diff)
    .order("created_at", { ascending: true })
    .limit(50);

  const filterHref = (r: string, d: string, st = activeStack?.id) =>
    `/prep/bank?round=${r}&diff=${d}${st ? `&stack=${encodeURIComponent(st)}` : ""}`;

  return (
    <>
      <AppNav />
      <PageShell
        title="Question bank"
        description={
          <>
            Real questions for <span className="font-medium">{roleTrack}</span>{" "}
            — browse, think out loud, then reveal what a great answer covers.
          </>
        }
      >

        {/* Filters */}
        <div className="mb-6 space-y-2">
          {stackTabs.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b pb-2">
              {stackTabs.map((t: { id: string; label: string }) => (
                <Link
                  key={t.id}
                  href={filterHref(round, diff, t.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    activeStack?.id === t.id
                      ? "border-primary bg-primary/10 font-medium"
                      : "hover:bg-accent"
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {ROUNDS.map((r) => (
              <Link
                key={r.value}
                href={filterHref(r.value, diff)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  round === r.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DIFFS.map((d) => (
              <Link
                key={d}
                href={filterHref(round, d)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                  diff === d
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                {d}
              </Link>
            ))}
          </div>
        </div>

        {!questions || questions.length === 0 ? (
          <Card>
            <CardHeader className="items-center text-center">
              <CardTitle className="text-base">
                Nothing here yet for this combo
              </CardTitle>
              <CardDescription>
                Be the first — generate a set of {diff} {round.replace("_", " ")}{" "}
                questions for {roleTrack}. It&apos;s cached for everyone after
                that.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <BankSeeder
                roleTrack={roleTrack}
                roundType={round}
                difficulty={diff}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <details
                key={q.id}
                className="group rounded-lg border p-4 open:bg-muted/30"
              >
                <summary className="flex cursor-pointer list-none items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-sm font-medium">
                    {q.question}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {(q.tags ?? []).slice(0, 2).map((t: string) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </summary>
                <div className="mt-3 border-t pt-3 pl-7">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    A strong answer covers:
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {((q.ideal_points ?? []) as string[]).map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <AddToPractice questionId={q.id} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </PageShell>
    </>
  );
}
