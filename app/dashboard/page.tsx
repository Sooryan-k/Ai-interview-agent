import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CurriculumSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Flame, Mic, Target, TrendingDown } from "lucide-react";
import { utcDay } from "@/lib/streak";
import { PageShell } from "@/components/PageShell";
import { DailyDrill } from "@/components/dashboard/DailyDrill";
import { SkillRadar } from "@/components/dashboard/SkillRadar";
import { WeaknessHeatmap } from "@/components/dashboard/WeaknessHeatmap";
import { DeliveryTrends } from "@/components/dashboard/DeliveryTrends";
import {
  aggregateSkills,
  aggregateDelivery,
  buildHeatmap,
  type EvalTurnRow,
} from "@/lib/analytics";
import { LevelPanel } from "@/components/dashboard/LevelPanel";
import type { XpInputs } from "@/lib/xp";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: enrollments }, { data: interviews }, { data: profile }] =
    await Promise.all([
      supabase
        .from("user_track_progress")
        .select(
          "curriculum_id, topic_status, quiz_scores, current_level, updated_at, curricula (stack_label, structure)"
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("interviews")
        .select(
          "id, role_track, round_type, difficulty, status, started_at, reports (overall_score)"
        )
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(10),
      supabase
        .from("profiles")
        .select("display_name, username, streak_count, last_active_date")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (!enrollments || enrollments.length === 0) redirect("/onboarding");

  // Show the flame only while the streak is alive (active today or yesterday).
  const today = utcDay();
  const yesterday = utcDay(new Date(Date.now() - 86_400_000));
  const streakAlive =
    profile?.last_active_date === today ||
    profile?.last_active_date === yesterday;

  // Insights from data already collected (evals + speech metrics) — zero AI cost.
  const interviewMeta = (interviews ?? []).map((iv) => ({
    id: iv.id,
    started_at: iv.started_at,
    role_track: iv.role_track,
  }));
  let skills: ReturnType<typeof aggregateSkills> = [];
  let heatmap: ReturnType<typeof buildHeatmap> = { interviews: [], rows: [] };
  let delivery: ReturnType<typeof aggregateDelivery> = {
    points: [],
    insight: null,
  };
  if (interviewMeta.length > 0) {
    const { data: evalTurns } = await supabase
      .from("turns")
      .select("interview_id, eval, speech_metrics, created_at")
      .in(
        "interview_id",
        interviewMeta.map((iv) => iv.id)
      )
      .eq("speaker", "user")
      .not("eval", "is", null);
    const rows = (evalTurns ?? []) as EvalTurnRow[];
    skills = aggregateSkills(rows);
    heatmap = buildHeatmap(rows, interviewMeta);
    delivery = aggregateDelivery(rows, interviewMeta);
  }
  const hasInsights =
    skills.length >= 3 || heatmap.rows.length > 0 || delivery.points.length >= 2;

  // ---- XP inputs (derived from existing data; 2 extra count queries) ----
  const completedInterviews = (interviews ?? []).filter((iv) => {
    const rep = Array.isArray(iv.reports) ? iv.reports[0] : iv.reports;
    return rep?.overall_score != null;
  });
  const scores = completedInterviews
    .map((iv) => {
      const rep = Array.isArray(iv.reports) ? iv.reports[0] : iv.reports;
      return rep?.overall_score as number | undefined;
    })
    .filter((s): s is number => typeof s === "number");
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  let topicsMastered = 0;
  let quizzesPassed = 0;
  for (const e of enrollments) {
    const statusMap = (e.topic_status ?? {}) as Record<string, string>;
    topicsMastered += Object.values(statusMap).filter((s) => s === "mastered").length;
    const qs = (e.quiz_scores ?? {}) as Record<string, { pct: number }>;
    quizzesPassed += Object.values(qs).filter((q) => q.pct >= 70).length;
  }

  const [{ count: cardsReviewed }, { count: storiesPolished }] =
    await Promise.all([
      supabase
        .from("user_question_stats")
        .select("question_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("last_result", "is", null),
      supabase
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("polished_md", "is", null),
    ]);

  const xpInputs: XpInputs = {
    interviewsCompleted: completedInterviews.length,
    avgScore,
    topicsMastered,
    quizzesPassed,
    cardsReviewed: cardsReviewed ?? 0,
    streak: streakAlive ? profile?.streak_count ?? 0 : 0,
    storiesPolished: storiesPolished ?? 0,
  };

  const paths = enrollments.map((e) => {
    const cur = Array.isArray(e.curricula) ? e.curricula[0] : e.curricula;
    const parsed = CurriculumSchema.safeParse(cur?.structure);
    const topics = parsed.success
      ? parsed.data.levels.flatMap((l) => l.modules.flatMap((m) => m.topics))
      : [];
    const statusMap = (e.topic_status ?? {}) as Record<string, string>;
    const mastered = topics.filter(
      (t) => statusMap[t.key] === "mastered"
    ).length;
    return {
      curriculumId: e.curriculum_id,
      label: cur?.stack_label ?? "Prep path",
      total: topics.length,
      mastered,
      pct: topics.length ? Math.round((mastered / topics.length) * 100) : 0,
      levelTitle: parsed.success
        ? parsed.data.levels[e.current_level ?? 0]?.title
        : undefined,
    };
  });

  return (
    <>
      <AppNav />
      <PageShell
        maxWidth="wide"
        className="space-y-8"
        title={`Hey${profile?.username ? ` @${profile.username}` : profile?.display_name ? ` ${profile.display_name}` : ""} 👋`}
        description="Pick up where you left off, or start a new round."
        actions={
          streakAlive && (profile?.streak_count ?? 0) > 0 ? (
            <div
              className="flex items-center gap-1.5 rounded-full border bg-orange-500/10 px-3 py-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400"
              title="Days in a row you've studied, drilled or interviewed"
            >
              <Flame className="size-4" />
              {profile!.streak_count}
              <span className="hidden font-normal text-muted-foreground sm:inline">
                day streak
              </span>
            </div>
          ) : undefined
        }
      >

        <div className="grid gap-4 md:grid-cols-2">
          <DailyDrill />
          <LevelPanel inputs={xpInputs} />
        </div>

        {/* Insights — computed from data the app already collects, zero AI cost */}
        {hasInsights && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Your insights</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {skills.length >= 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="size-4 text-primary" /> Skill radar
                    </CardTitle>
                    <CardDescription>
                      Average answer score per skill across your interviews
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SkillRadar data={skills} />
                  </CardContent>
                </Card>
              )}
              {heatmap.rows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingDown className="size-4 text-primary" /> Weak spots
                    </CardTitle>
                    <CardDescription>
                      Where to focus next — weakest skills first
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WeaknessHeatmap data={heatmap} />
                  </CardContent>
                </Card>
              )}
              {delivery.points.length >= 2 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mic className="size-4 text-primary" /> Delivery coaching
                    </CardTitle>
                    <CardDescription>
                      {delivery.insight ??
                        "How your speaking delivery is trending across voice interviews"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DeliveryTrends points={delivery.points} />
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Prep paths */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your prep paths</h2>
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/onboarding">+ New stack</Link>}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {paths.map((p) => (
              <Link key={p.curriculumId} href={`/prep?c=${p.curriculumId}`}>
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader>
                    <CardTitle className="text-base">{p.label}</CardTitle>
                    <CardDescription>
                      {p.levelTitle ? `Currently: ${p.levelTitle} · ` : ""}
                      {p.mastered}/{p.total} topics mastered
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Progress value={p.pct} className="h-2" />
                      <span className="text-sm font-medium tabular-nums">
                        {p.pct}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Interview history */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Recent interviews</h2>
            <Button
              size="sm"
              render={<Link href="/interview/new">New interview</Link>}
            />
          </div>
          {!interviews || interviews.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No interviews yet. Your first mock round takes ~10 minutes —
                voice or text.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y rounded-lg border">
              {interviews.map((iv) => {
                const report = Array.isArray(iv.reports)
                  ? iv.reports[0]
                  : iv.reports;
                const score = report?.overall_score;
                const href = report
                  ? `/report/${iv.id}`
                  : `/interview/${iv.id}`;
                return (
                  <Link
                    key={iv.id}
                    href={href}
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {iv.role_track}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(iv.started_at).toLocaleDateString()} ·{" "}
                        {iv.round_type.replace("_", " ")} · {iv.difficulty}
                      </p>
                    </div>
                    {score != null ? (
                      <span
                        className={cn(
                          "text-lg font-bold tabular-nums",
                          score >= 75
                            ? "text-emerald-600 dark:text-emerald-400"
                            : score >= 50
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {score}
                      </span>
                    ) : (
                      <Badge
                        variant={
                          iv.status === "active" ? "default" : "secondary"
                        }
                      >
                        {iv.status === "active" ? "Resume" : iv.status}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </PageShell>
    </>
  );
}
