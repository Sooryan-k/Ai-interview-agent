import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { computeXp, type XpInputs } from "@/lib/xp";
import { cn } from "@/lib/utils";

export function LevelPanel({ inputs }: { inputs: XpInputs }) {
  const r = computeXp(inputs);
  const earned = r.badges.filter((b) => b.earned);
  const pct = Math.round((r.intoLevel / r.levelSpan) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Level {r.level} · {r.levelTitle}
          </CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums">
            {r.xp.toLocaleString()} XP
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-2" />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {r.intoLevel}/{r.levelSpan}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.badges.map((b) => (
            <span
              key={b.key}
              title={b.earned ? b.label : `Locked — ${b.hint}`}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-opacity",
                b.earned
                  ? "border-primary/40 bg-primary/5"
                  : "opacity-40 grayscale"
              )}
            >
              <span>{b.icon}</span>
              <span className={cn(!b.earned && "text-muted-foreground")}>
                {b.label}
              </span>
            </span>
          ))}
        </div>
        {earned.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Complete an interview or pass a quiz to start earning badges.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
