import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PerQuestion {
  q: string;
  answer_summary: string;
  model_answer: string;
  score: number;
}

function scoreColor(score: number, outOf: number) {
  const pct = (score / outOf) * 100;
  if (pct >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/**
 * Public, read-only report page. Access is gated by the unguessable slug —
 * only reports the owner explicitly shared have one. No login required.
 */
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slug || slug.length < 8) notFound();

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("reports")
    .select(
      "interview_id, overall_score, strengths, weaknesses, per_question, recommendations, created_at"
    )
    .eq("share_slug", slug)
    .maybeSingle();
  if (!report) notFound();

  const { data: interview } = await admin
    .from("interviews")
    .select("role_track, round_type, difficulty, started_at")
    .eq("id", report.interview_id)
    .maybeSingle();

  const strengths = (report.strengths ?? []) as string[];
  const weaknesses = (report.weaknesses ?? []) as string[];
  const perQuestion = (report.per_question ?? []) as PerQuestion[];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-6 py-10">
      <div className="print-hidden rounded-lg border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
        Shared mock-interview report ·{" "}
        <Link href="/" className="underline underline-offset-2">
          made with dryrun AI — practice yours free
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Mock interview report ·{" "}
            {new Date(report.created_at).toLocaleDateString()}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {interview?.role_track ?? "Interview"}
          </h1>
          <div className="mt-1 flex gap-2">
            {interview?.round_type && (
              <Badge variant="outline">
                {interview.round_type.replace("_", " ")}
              </Badge>
            )}
            {interview?.difficulty && (
              <Badge variant="outline">{interview.difficulty}</Badge>
            )}
          </div>
        </div>
        <div className="text-center">
          <div
            className={cn(
              "text-4xl font-bold tabular-nums sm:text-5xl",
              scoreColor(report.overall_score ?? 0, 100)
            )}
          >
            {report.overall_score}
          </div>
          <p className="text-xs text-muted-foreground">overall / 100</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-amber-600 dark:text-amber-400">
              Areas to improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question by question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {perQuestion.map((pq, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{pq.q}</p>
                <span
                  className={cn(
                    "shrink-0 text-lg font-bold tabular-nums",
                    scoreColor(pq.score, 10)
                  )}
                >
                  {pq.score}/10
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Candidate: </span>
                {pq.answer_summary}
              </p>
              <p className="mt-2 rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">Model answer: </span>
                {pq.model_answer}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="print-hidden flex justify-center pb-6">
        <Button render={<Link href="/login">Practice your own interview →</Link>} />
      </div>
    </main>
  );
}
