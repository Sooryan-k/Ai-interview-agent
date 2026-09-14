import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PathSummary {
  curriculumId: string;
  label: string;
  mastered: number;
  total: number;
}

/**
 * Tabs across the user's study paths — one per technology they selected.
 *
 * Rendered only when there's more than one, so a single-stack user sees no
 * chrome they don't need.
 */
export function PathSwitcher({
  paths,
  currentId,
}: {
  paths: PathSummary[];
  currentId: string;
}) {
  if (paths.length < 2) return null;

  return (
    <div className="-mx-4 mb-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max min-w-full gap-1.5 border-b pb-2">
        {paths.map((p) => {
          const active = p.curriculumId === currentId;
          const pct =
            p.total > 0 ? Math.round((p.mastered / p.total) * 100) : 0;
          return (
            <Link
              key={p.curriculumId}
              href={`/prep?c=${p.curriculumId}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-primary bg-primary/10 font-medium"
                  : "hover:bg-accent"
              )}
            >
              {p.label}
              <span
                className={cn(
                  "ml-2 text-xs tabular-nums",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {pct}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
