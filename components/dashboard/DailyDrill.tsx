"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Flame, Trophy, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DrillQuestion {
  id: string;
  stackId: string;
  stackName: string;
  question: string;
  /** Only sent once answered — the card can't be revealed from the payload. */
  idealPoints: string[] | null;
  tags: string[];
  answeredAt: string | null;
  result: "got_it" | "missed" | null;
}

interface Progress {
  total: number;
  answered: number;
  correct: number;
  complete: boolean;
  scorePct: number | null;
}

/**
 * One question per selected technology, per day.
 *
 * The set is fetched, never generated here, and answered state comes from the
 * server — so a refresh, a new tab or a return visit shows the same questions
 * with the same answers still marked.
 */
export function DailyDrill() {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<DrillQuestion[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [needsStacks, setNeedsStacks] = useState(false);
  const [emptyBank, setEmptyBank] = useState<
    { stackId: string; stackName: string }[]
  >([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [grading, setGrading] = useState<string | null>(null);

  useEffect(() => {
    // The day boundary is the user's, not the server's.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/drill?tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data.questions ?? []);
        setProgress(data.progress ?? null);
        setNeedsStacks(Boolean(data.needsStacks));
        setEmptyBank(data.emptyBank ?? []);
      })
      .catch(() => toast.error("Couldn't load today's drill."))
      .finally(() => setLoading(false));
  }, []);

  async function grade(q: DrillQuestion, result: "got_it" | "missed") {
    setGrading(q.id);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillId: q.id, result }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Couldn't save — try again.");
        return;
      }
      setQuestions((qs) =>
        qs.map((x) =>
          x.id === q.id
            ? {
                ...x,
                answeredAt: new Date().toISOString(),
                result,
                idealPoints: data.idealPoints ?? x.idealPoints,
              }
            : x
        )
      );
      setProgress(data.progress ?? null);
      if (data.streak != null) setStreak(data.streak);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setGrading(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Daily drill
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="animate-pulse text-sm text-muted-foreground">
            Loading today&apos;s questions…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (needsStacks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Daily drill
          </CardTitle>
          <CardDescription>
            Choose your technologies in{" "}
            <Link href="/settings" className="underline underline-offset-2">
              Settings
            </Link>{" "}
            and you&apos;ll get one question a day for each of them.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Daily drill
          </CardTitle>
          <CardDescription>
            The question bank is still filling up for your technologies.{" "}
            <Link href="/prep/bank" className="underline underline-offset-2">
              Browse the bank
            </Link>{" "}
            to get it started.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const done = progress?.complete ?? false;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Daily drill
          </CardTitle>
          {progress && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {progress.answered} of {progress.total} answered today
            </span>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{
                width: `${(progress.answered / progress.total) * 100}%`,
              }}
            />
          </div>
        )}
        <CardDescription>
          {done
            ? "Done for today — the next set arrives tomorrow."
            : "One question per technology. Same set all day."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {done && progress && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Trophy className="size-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">
                {progress.correct} of {progress.total} right
                {progress.scorePct != null && ` — ${progress.scorePct}%`}
              </p>
              {streak != null && (
                <p className="inline-flex items-center gap-1 text-xs text-orange-500">
                  <Flame className="size-3.5" /> {streak}-day streak
                </p>
              )}
            </div>
          </div>
        )}

        {questions.map((q) => {
          const answered = Boolean(q.answeredAt);
          const isRevealed = revealed.has(q.id) || answered;
          return (
            <div
              key={q.id}
              className={cn(
                "rounded-lg border p-3",
                answered && "bg-muted/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    answered && "text-muted-foreground"
                  )}
                >
                  {q.question}
                </p>
                <Badge variant="outline" className="shrink-0">
                  {q.stackName}
                </Badge>
              </div>

              {answered ? (
                <p
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                    q.result === "got_it"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {q.result === "got_it" ? (
                    <>
                      <Check className="size-3.5" /> Got it
                    </>
                  ) : (
                    <>
                      <X className="size-3.5" /> Missed it
                    </>
                  )}
                </p>
              ) : !isRevealed ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() =>
                    setRevealed((s) => new Set(s).add(q.id))
                  }
                >
                  Think first, then reveal
                </Button>
              ) : null}

              {isRevealed && (q.idealPoints?.length ?? 0) > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {q.idealPoints!.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}

              {isRevealed && !answered && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    disabled={grading === q.id}
                    onClick={() => grade(q, "got_it")}
                  >
                    <Check data-icon="inline-start" /> I got it
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={grading === q.id}
                    onClick={() => grade(q, "missed")}
                  >
                    <X data-icon="inline-start" /> Missed it
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {emptyBank.length > 0 && (
          <p className="text-xs text-muted-foreground">
            No bank questions yet for{" "}
            {emptyBank.map((s) => s.stackName).join(", ")}.{" "}
            <Link href="/prep/bank" className="underline underline-offset-2">
              Seed the bank
            </Link>{" "}
            to include {emptyBank.length === 1 ? "it" : "them"} tomorrow.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
