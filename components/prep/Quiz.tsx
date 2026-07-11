"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Flame, ThumbsUp, Trophy, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { QuizQuestion } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Phase = "loading" | "quiz" | "done" | "error" | "quota";

export function Quiz({
  curriculumId,
  moduleKey,
  moduleTitle,
}: {
  curriculumId: string;
  moduleKey: string;
  moduleTitle: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // mcq choice
  const [shortAnswer, setShortAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [selfMark, setSelfMark] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const [quotaMsg, setQuotaMsg] = useState("");
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/${moduleKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curriculumId }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (r.ok && data.quiz?.questions?.length) {
          setQuestions(data.quiz.questions);
          setPhase("quiz");
        } else if (r.status === 429) {
          setQuotaMsg(data.message || "AI budget is spent — try tomorrow.");
          setPhase("quota");
        } else {
          setPhase("error");
        }
      })
      .catch(() => setPhase("error"));
  }, [curriculumId, moduleKey]);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  function check() {
    if (!q) return;
    if (q.type === "mcq") {
      if (picked === null) return;
      if (picked === q.answer) setCorrect((c) => c + 1);
      setChecked(true);
    } else {
      setChecked(true); // reveal ideal points; user self-marks below
    }
  }

  function selfGrade(gotIt: boolean) {
    setSelfMark(gotIt);
    if (gotIt) setCorrect((c) => c + 1);
  }

  async function next() {
    if (isLast) {
      setPhase("done");
      try {
        const res = await fetch(`/api/quiz/${moduleKey}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            curriculumId,
            score: correct,
            total: questions.length,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.streak) setStreak(data.streak);
      } catch {
        toast.error("Score couldn't be saved (kept locally).");
      }
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
    setShortAnswer("");
    setChecked(false);
    setSelfMark(null);
  }

  if (phase === "loading") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground animate-pulse">
          Preparing the {moduleTitle} checkpoint quiz…
          <br />
          (first time for this module generates it — a few seconds)
        </CardContent>
      </Card>
    );
  }
  if (phase === "quota") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {quotaMsg}
        </CardContent>
      </Card>
    );
  }
  if (phase === "error") {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center text-sm text-muted-foreground">
          Couldn&apos;t load the quiz.
          <div>
            <Button size="sm" variant="outline" onClick={() => location.reload()}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            {pct >= 80 ? (
              <Trophy className="size-6 text-amber-500" />
            ) : pct >= 50 ? (
              <ThumbsUp className="size-6 text-emerald-600" />
            ) : (
              <BookOpen className="size-6 text-muted-foreground" />
            )}
            {correct}/{questions.length} ({pct}%)
          </CardTitle>
          <CardDescription>
            {pct >= 80
              ? "Strong — you're ready for the next module."
              : pct >= 50
                ? "Decent — skim the missed topics before moving on."
                : "Worth re-studying this module before the interview."}
            {streak != null && (
              <span className="mt-1 flex items-center justify-center gap-1 text-orange-500">
                <Flame className="size-3.5" /> {streak}-day streak
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => location.reload()}>
            Retake
          </Button>
          <Button render={<Link href="/prep">Back to roadmap</Link>} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{moduleTitle} — checkpoint</CardTitle>
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {idx + 1}/{questions.length}
          </Badge>
        </div>
        <Progress value={(idx / questions.length) * 100} className="h-1.5" />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">{q.q}</p>

        {q.type === "mcq" ? (
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isAnswer = i === q.answer;
              const isPicked = i === picked;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={checked}
                  onClick={() => setPicked(i)}
                  className={cn(
                    "w-full rounded-md border p-3 text-left text-sm transition-colors",
                    !checked && "hover:bg-accent",
                    !checked && isPicked && "border-primary bg-accent",
                    checked && isAnswer &&
                      "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    checked && isPicked && !isAnswer &&
                      "border-red-500 bg-red-500/10 text-red-700 dark:text-red-300"
                  )}
                >
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <Textarea
            value={shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            placeholder="Answer in 1-3 sentences, as you would say it out loud…"
            rows={3}
            disabled={checked}
          />
        )}

        {checked && (
          <div className="space-y-2 rounded-md bg-muted/60 p-3 text-sm">
            {q.type === "short" && (
              <>
                <p className="font-medium">A great answer covers:</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {q.ideal_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {q.explanation && (
              <p className="text-muted-foreground">{q.explanation}</p>
            )}
            {q.type === "short" && selfMark === null && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => selfGrade(true)}>
                  <Check data-icon="inline-start" /> I covered it
                </Button>
                <Button size="sm" variant="outline" onClick={() => selfGrade(false)}>
                  <X data-icon="inline-start" /> I missed it
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {!checked ? (
            <Button
              onClick={check}
              disabled={q.type === "mcq" ? picked === null : !shortAnswer.trim()}
            >
              Check
            </Button>
          ) : q.type === "short" && selfMark === null ? null : (
            <Button onClick={next}>
              {isLast ? "Finish quiz" : "Next question"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
