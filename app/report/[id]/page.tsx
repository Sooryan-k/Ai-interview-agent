import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: report } = await supabase
    .from("reports")
    .select(
      "overall_score, strengths, weaknesses, per_question, recommendations, created_at"
    )
    .eq("interview_id", id)
    .maybeSingle();
  if (!report) redirect(`/interview/${id}`);

  const { data: interview } = await supabase
    .from("interviews")
    .select("role_track, round_type, difficulty, curriculum_id, started_at")
    .eq("id", id)
    .maybeSingle();

  const { data: turns } = await supabase
    .from("turns")
    .select("speaker, text, speech_metrics")
    .eq("interview_id", id)
    .order("idx", { ascending: true });

  // Aggregate client-computed speech metrics (free confidence signals).
  const userTurns = (turns ?? []).filter((t) => t.speaker === "user");
  const metrics = userTurns
    .map((t) => t.speech_metrics as { fillers?: number; wpm?: number; long_pauses?: number } | null)
    .filter(Boolean) as { fillers?: number; wpm?: number; long_pauses?: number }[];
  const totalFillers = metrics.reduce((s, m) => s + (m.fillers ?? 0), 0);
  const wpmValues = metrics.map((m) => m.wpm ?? 0).filter((v) => v > 0);
  const avgWpm = wpmValues.length
    ? Math.round(wpmValues.reduce((s, v) => s + v, 0) / wpmValues.length)
    : null;
  const totalPauses = metrics.reduce((s, m) => s + (m.long_pauses ?? 0), 0);

  const strengths = (report.strengths ?? []) as string[];
  const weaknesses = (report.weaknesses ?? []) as string[];
  const perQuestion = (report.per_question ?? []) as PerQuestion[];
  const recommendations = (report.recommendations ?? []) as string[];

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Interview report</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {interview?.role_track}
            </h1>
            <div className="mt-1 flex gap-2">
              <Badge variant="outline">
                {interview?.round_type?.replace("_", " ")}
              </Badge>
              <Badge variant="outline">{interview?.difficulty}</Badge>
            </div>
          </div>
          <div className="text-center">
            <div
              className={cn(
                "text-5xl font-bold tabular-nums",
                scoreColor(report.overall_score ?? 0, 100)
              )}
            >
              {report.overall_score}
            </div>
            <p className="text-xs text-muted-foreground">overall / 100</p>
          </div>
        </div>

        {/* Strengths & weaknesses */}
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

        {/* Speech confidence metrics */}
        {metrics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Delivery (from your voice answers)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {totalFillers}
                </div>
                <p className="text-xs text-muted-foreground">
                  filler words (um, like…)
                </p>
              </div>
              {avgWpm !== null && (
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {avgWpm}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    avg words/minute (aim 120–160)
                  </p>
                </div>
              )}
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {totalPauses}
                </div>
                <p className="text-xs text-muted-foreground">
                  long pauses (&gt;2.5s)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-question breakdown */}
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
                  <span className="font-medium text-foreground">You: </span>
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

        {/* Recommendations */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">What to do next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ol>
            {interview?.curriculum_id && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link href={`/prep?c=${interview.curriculum_id}`}>
                    Open your roadmap to restudy →
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Transcript replay */}
        <Accordion multiple={false}>
          <AccordionItem value="transcript" className="rounded-lg border px-4">
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              Replay full transcript
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              {(turns ?? []).map((t, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">
                    {t.speaker === "ai" ? "Interviewer" : "You"}:{" "}
                  </span>
                  <span className="whitespace-pre-wrap text-muted-foreground">
                    {t.text}
                  </span>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex justify-center gap-3 pb-6">
          <Button
            variant="outline"
            render={<Link href="/interview/new">Another round</Link>}
          />
          <Button
            variant="ghost"
            render={<Link href="/dashboard">Back to dashboard</Link>}
          />
        </div>
      </main>
    </>
  );
}
