"use client";

import { useState } from "react";
import { Mic, Target, TrendingDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SkillRadar } from "@/components/dashboard/SkillRadar";
import { WeaknessHeatmap } from "@/components/dashboard/WeaknessHeatmap";
import { DeliveryTrends } from "@/components/dashboard/DeliveryTrends";
import type {
  DeliveryPoint,
  HeatmapData,
  SkillStat,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

export interface InsightView {
  stackId: string | null;
  label: string;
  skills: SkillStat[];
  heatmap: HeatmapData;
  delivery: { points: DeliveryPoint[]; insight: string | null };
}

/**
 * Insights, split by technology.
 *
 * Merging every stack into one average was the bug: a candidate strong in
 * React and weak in PostgreSQL saw a single mid-range score and no way to tell
 * which was which. "All stacks" stays the default because it answers "how am I
 * doing"; the per-stack tabs answer "what should I study".
 */
export function InsightTabs({ views }: { views: InsightView[] }) {
  const [active, setActive] = useState(0);
  const view = views[active] ?? views[0];
  if (!view) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Your insights</h2>
        {views.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {views.map((v, i) => (
              <button
                key={v.stackId ?? "all"}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  i === active
                    ? "border-primary bg-primary/10 font-medium"
                    : "hover:bg-accent"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {view.skills.length >= 3 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-primary" /> Skill radar
              </CardTitle>
              <CardDescription>
                Average score per skill
                {view.stackId ? ` in ${view.label} rounds` : " across your interviews"}
                {" — answered questions only"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SkillRadar data={view.skills} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-primary" /> Skill radar
              </CardTitle>
              <CardDescription>
                Not enough answered questions in {view.label} yet — the radar
                needs at least three skills with an answer behind them.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {view.heatmap.rows.length > 0 && (
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
              <WeaknessHeatmap data={view.heatmap} />
            </CardContent>
          </Card>
        )}

        {view.delivery.points.length >= 2 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="size-4 text-primary" /> Delivery coaching
              </CardTitle>
              <CardDescription>
                {view.delivery.insight ??
                  "How your speaking delivery is trending across voice interviews"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeliveryTrends points={view.delivery.points} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Skills they keep declining to answer — invisible in the radar by
          design, but the most actionable thing on the page. */}
      {view.skills.some((s) => s.skipped > 0) && (
        <p className="text-xs text-muted-foreground">
          Skipped without answering:{" "}
          {view.skills
            .filter((s) => s.skipped > 0)
            .sort((a, b) => b.skipped - a.skipped)
            .slice(0, 5)
            .map((s) => `${s.skill} (${s.skipped})`)
            .join(", ")}
          .
        </p>
      )}
    </section>
  );
}
