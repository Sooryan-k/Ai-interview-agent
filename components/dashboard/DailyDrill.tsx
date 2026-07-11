"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Flame, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface DrillQuestion {
  id: string;
  question: string;
  ideal_points: string[];
  tags: string[];
}

type State = "loading" | "ready" | "revealed" | "graded" | "empty";

export function DailyDrill() {
  const [state, setState] = useState<State>("loading");
  const [q, setQ] = useState<DrillQuestion | null>(null);
  const [kind, setKind] = useState<"daily" | "review">("daily");
  const [streak, setStreak] = useState<number | null>(null);
  const [nextInDays, setNextInDays] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/drill")
      .then((r) => r.json())
      .then((data) => {
        if (data.question) {
          setQ(data.question);
          setKind(data.kind === "review" ? "review" : "daily");
          setState("ready");
        } else {
          setState("empty");
        }
      })
      .catch(() => setState("empty"));
  }, []);

  async function grade(result: "got_it" | "missed") {
    if (!q) return;
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, result }),
      });
      const data = await res.json();
      if (res.ok) {
        setStreak(data.streak ?? null);
        setNextInDays(data.nextInDays ?? null);
        setState("graded");
      } else {
        toast.error("Couldn't save — try again.");
      }
    } catch {
      toast.error("Network error — try again.");
    }
  }

  if (state === "empty") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Daily drill
          </CardTitle>
          <CardDescription>
            The question bank is still filling up.{" "}
            <Link href="/prep/bank" className="underline underline-offset-2">
              Browse the bank
            </Link>{" "}
            to get it started.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4 text-primary" /> Daily drill{" "}
            {kind === "review" && (
              <Badge variant="secondary" className="ml-1 align-middle">
                review
              </Badge>
            )}
          </CardTitle>
          {q?.tags?.[0] && <Badge variant="outline">{q.tags[0]}</Badge>}
        </div>
        <CardDescription>
          One question a day keeps interview rust away.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === "loading" ? (
          <p className="animate-pulse text-sm text-muted-foreground">
            Picking today&apos;s question…
          </p>
        ) : state === "graded" ? (
          <div className="space-y-1 py-1 text-sm">
            <p className="font-medium">
              Nice — logged.{" "}
              {streak != null && (
                <span className="inline-flex items-center gap-1 text-orange-500"><Flame className="size-3.5" /> {streak}-day streak</span>
              )}
            </p>
            {nextInDays != null && (
              <p className="text-xs text-muted-foreground">
                You&apos;ll see this one again in {nextInDays}{" "}
                {nextInDays === 1 ? "day" : "days"}.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">{q?.question}</p>
            {state === "ready" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setState("revealed")}
              >
                Think first, then reveal the ideal answer
              </Button>
            ) : (
              <>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {(q?.ideal_points ?? []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => grade("got_it")}>
                    <Check data-icon="inline-start" /> I got it
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => grade("missed")}
                  >
                    <X data-icon="inline-start" /> Missed it
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
