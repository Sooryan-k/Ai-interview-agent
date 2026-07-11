import type { HeatmapData } from "@/lib/analytics";
import { cn } from "@/lib/utils";

function cellClass(score: number | null): string {
  if (score === null) return "bg-muted/40";
  if (score >= 8) return "bg-emerald-500/80";
  if (score >= 6.5) return "bg-emerald-500/45";
  if (score >= 5) return "bg-amber-500/60";
  if (score >= 3.5) return "bg-orange-500/70";
  return "bg-red-500/75";
}

/** Skill × interview grid, weakest skills first. Pure markup — no chart lib. */
export function WeaknessHeatmap({ data }: { data: HeatmapData }) {
  if (data.rows.length === 0 || data.interviews.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {/* header row: interview numbers */}
      <div className="flex items-center gap-1.5">
        <span className="w-32 shrink-0 sm:w-40" />
        {data.interviews.map((iv) => (
          <span
            key={iv.id}
            className="w-8 text-center text-[10px] text-muted-foreground tabular-nums"
          >
            {iv.label}
          </span>
        ))}
        <span className="pl-1 text-[10px] text-muted-foreground">avg</span>
      </div>
      {data.rows.map((row) => (
        <div key={row.skill} className="flex items-center gap-1.5">
          <span
            className="w-32 shrink-0 truncate text-xs sm:w-40"
            title={row.skill}
          >
            {row.skill}
          </span>
          {row.cells.map((score, i) => (
            <span
              key={i}
              title={score === null ? "not covered" : `${score}/10`}
              className={cn("h-5 w-8 rounded-sm", cellClass(score))}
            />
          ))}
          <span className="pl-1 text-xs tabular-nums text-muted-foreground">
            {row.avg.toFixed(1)}
          </span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Rows = skills from your answer evaluations (weakest first) · columns =
        recent interviews.
      </p>
    </div>
  );
}
