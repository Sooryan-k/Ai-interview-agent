"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { SkillStat } from "@/lib/analytics";

/** Radar of avg eval score (0-100) per skill tag, from interview evals. */
export function SkillRadar({ data }: { data: SkillStat[] }) {
  if (data.length < 3) return null; // a radar needs ≥3 axes to read well
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Radar
            dataKey="score"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.25}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
