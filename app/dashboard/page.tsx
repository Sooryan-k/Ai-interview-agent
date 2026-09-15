import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CurriculumSchema } from "@/lib/schemas";
import { Flame } from "lucide-react";
import { previousDay, utcDay } from "@/lib/streak";
import { PageShell } from "@/components/PageShell";
import { DailyDrill } from "@/components/dashboard/DailyDrill";
import {
  aggregateSkills,
  aggregateDelivery,
  buildHeatmap,
  filterByStack,
  stacksWithData,
  type EvalTurnRow,
} from "@/lib/analytics";
import { stackName } from "@/lib/stacks";
import { InsightTabs } from "@/components/dashboard/InsightTabs";
import { LevelPanel } from "@/components/dashboard/LevelPanel";
import { RolePrompt } from "@/components/stacks/RolePrompt";
import { PrepPathsList } from "@/components/dashboard/PrepPathsList";
import { RecentInterviews } from "@/components/dashboard/RecentInterviews";
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
          "id, role_track, round_type, difficulty, status, started_at, stack_ids, reports (overall_score)"
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
  const yesterday = previousDay(today);
  const streakAlive =
    profile?.last_active_date === today ||
    profile?.last_active_date === yesterday;

  // Insights from data already collected (evals + speech metrics) — zero AI cost.
  const interviewMeta = (interviews ?? []).map((iv) => ({
    id: iv.id,
    started_at: iv.started_at,
    role_track: iv.role_track,
    stack_ids: (iv.stack_ids ?? []) as string[],
  }));
  let evalRows: EvalTurnRow[] = [];
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
    evalRows = (evalTurns ?? []) as EvalTurnRow[];
  }

  // Insights are computed per technology as well as overall. Merging every
  // stack into one average was hiding the useful signal: "strong in React,
  // weak in PostgreSQL" collapsed into a single mid-range number.
  const stackTabs = stacksWithData(interviewMeta);
  const buildInsights = (stackId: string | null) => {
    const scoped = filterByStack(evalRows, interviewMeta, stackId);
    return {
      stackId,
      label: stackId ? stackName(stackId) ?? stackId : "All stacks",
      skills: aggregateSkills(scoped.rows),
      heatmap: buildHeatmap(scoped.rows, scoped.interviews),
      delivery: aggregateDelivery(scoped.rows, scoped.interviews),
    };
  };

  const insightViews = [
    buildInsights(null),
    ...(stackTabs.length > 1 ? stackTabs.map((id: string) => buildInsights(id)) : []),
  ].filter(
    (v, i) =>
      // Keep "All stacks" always; drop per-stack views with nothing to show.
      i === 0 ||
      v.skills.length > 0 ||
      v.heatmap.rows.length > 0 ||
      v.delivery.points.length > 0
  );

  const overall = insightViews[0];
  const hasInsights =
    overall.skills.length >= 3 ||
    overall.heatmap.rows.length > 0 ||
    overall.delivery.points.length >= 2;

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
            <Tooltip>
              <TooltipTrigger
                render={
                  <div
                    tabIndex={0}
                    className="flex items-center gap-1.5 rounded-full border bg-orange-500/10 px-3 py-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400"
                  >
                    <Flame className="size-4" />
                    {profile!.streak_count}
                    <span className="hidden font-normal text-muted-foreground sm:inline">
                      day streak
                    </span>
                  </div>
                }
              />
              <TooltipContent>
                Days in a row you&apos;ve studied, drilled or interviewed
              </TooltipContent>
            </Tooltip>
          ) : undefined
        }
      >

        <RolePrompt />

        <div className="grid gap-4 md:grid-cols-2">
          <DailyDrill />
          <LevelPanel inputs={xpInputs} />
        </div>

        {/* Insights — computed from data the app already collects, zero AI cost */}
        {hasInsights && <InsightTabs views={insightViews} />}

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
          <PrepPathsList initial={paths} />
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
          <RecentInterviews
            initial={(interviews ?? []).map((iv) => {
              const report = Array.isArray(iv.reports)
                ? iv.reports[0]
                : iv.reports;
              return {
                id: iv.id,
                roleTrack: iv.role_track,
                startedAt: iv.started_at,
                roundType: iv.round_type,
                difficulty: iv.difficulty,
                status: iv.status,
                score: report?.overall_score ?? null,
                href: report ? `/report/${iv.id}` : `/interview/${iv.id}`,
              };
            })}
          />
        </section>
      </PageShell>
    </>
  );
}
