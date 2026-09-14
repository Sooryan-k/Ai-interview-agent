"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { stackName } from "@/lib/stacks";
import { toast } from "sonner";

/**
 * What the interviewer remembers asking, and the way to make it forget.
 *
 * Resetting is per-stack on purpose: someone revisiting React after six months
 * wants those questions back without also re-opening everything they were
 * asked about Postgres last week.
 */
export function QuestionHistory({ stackIds }: { stackIds: string[] }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/question-history")
      .then((r) => (r.ok ? r.json() : { counts: {} }))
      .then((d) => {
        if (!cancelled) setCounts(d.counts ?? {});
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reset(stackId: string, label: string) {
    setBusy(stackId);
    try {
      const res = await fetch(
        `/api/profile/question-history?stackId=${encodeURIComponent(stackId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Couldn't reset that history — try again.");
        return;
      }
      const data = await res.json();
      setCounts((c) => ({ ...(c ?? {}), [stackId]: 0 }));
      toast.success(
        `Cleared ${data.cleared ?? 0} ${label} question${data.cleared === 1 ? "" : "s"} — they can come up again.`
      );
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  // Anything they've been asked about, including stacks no longer on their
  // profile — otherwise that history would be unreachable.
  const rows = [
    ...new Set([...stackIds, ...Object.keys(counts ?? {})]),
  ]
    .map((id) => ({
      id,
      name: stackName(id) ?? id,
      count: counts?.[id] ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-primary" /> Question history
        </CardTitle>
        <CardDescription>
          Interviews never repeat a question you&apos;ve already been asked, or
          a reworded version of one. Reset a technology to make its questions
          available again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {counts === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing yet — your first interview will start filling this in.
          </p>
        ) : (
          <ul className="divide-y">
            {rows
              .filter((r) => r.count > 0)
              .map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{r.name}</span>{" "}
                    <span className="text-muted-foreground">
                      — {r.count} question{r.count === 1 ? "" : "s"} asked
                    </span>
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === r.id}
                          className="shrink-0"
                        >
                          <RotateCcw className="size-4" />
                          <span className="hidden sm:inline">Reset</span>
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Reset {r.name} question history?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          The {r.count} {r.name} question
                          {r.count === 1 ? "" : "s"} you&apos;ve already been
                          asked will be able to come up again in future
                          interviews. Your past interviews and reports are not
                          affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => reset(r.id, r.name)}>
                          Reset
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
