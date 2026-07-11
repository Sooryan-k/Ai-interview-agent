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
  searchParams: Promise<{ round?: string; diff?: string }>;
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

  // Role track = the user's most recent prep path.
  const { data: enrollment } = await supabase
    .from("user_track_progress")
    .select("curricula (stack_label)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cur = Array.isArray(enrollment?.curricula)
    ? enrollment?.curricula[0]
    : enrollment?.curricula;
  const roleTrack = cur?.stack_label ?? "Software Engineering";

  const { data: questions } = await supabase
    .from("question_bank")
    .select("id, question, ideal_points, tags, source")
    .eq("role_track", roleTrack)
    .eq("round_type", round)
    .eq("difficulty", diff)
    .order("created_at", { ascending: true })
    .limit(50);

  const filterHref = (r: string, d: string) => `/prep/bank?round=${r}&diff=${d}`;

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
