"use client";

import { useState } from "react";
import Link from "next/link";
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
import { toast } from "sonner";

interface Card {
  id: string;
  question: string;
  ideal_points: string[];
  tags: string[];
  round_type?: string;
}

/** SM-2 self-graded review deck. Zero AI cost. */
export function PracticeDeck({
  initialCards,
  totalCards,
}: {
  initialCards: Card[];
  totalCards: number;
}) {
  const [queue, setQueue] = useState<Card[]>(initialCards);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(initialCards.length === 0);
  const [reviewed, setReviewed] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);

  const card = queue[pos];
  const total = queue.length;

  async function grade(quality: number) {
    if (!card) return;
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", questionId: card.id, quality }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.streak) setStreak(data.streak);
    } catch {
      toast.error("Couldn't save — kept going anyway.");
    }
    setReviewed((r) => r + 1);
    if (pos + 1 >= total) {
      setDone(true);
    } else {
      setPos((p) => p + 1);
      setRevealed(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {reviewed > 0 ? "🎉 Deck cleared" : "✨ All caught up"}
          </CardTitle>
          <CardDescription>
            {reviewed > 0
              ? `Reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"}. They'll resurface exactly when you're about to forget them.`
              : totalCards > 0
                ? "Nothing is due right now — come back later, or add more from the question bank."
                : "You haven't added any cards yet. Drill questions from the bank to build your review deck."}
            {streak != null && (
              <span className="mt-1 block text-orange-500">
                🔥 {streak}-day streak
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button variant="outline" render={<Link href="/prep/bank">Browse the bank</Link>} />
          <Button render={<Link href="/dashboard">Back to dashboard</Link>} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={(pos / total) * 100} className="h-1.5" />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {pos + 1}/{total} due
        </span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Recall check</CardTitle>
            {card.tags?.[0] && <Badge variant="outline">{card.tags[0]}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium">{card.question}</p>

          {!revealed ? (
            <Button variant="outline" onClick={() => setRevealed(true)}>
              Answer out loud, then reveal
            </Button>
          ) : (
            <>
              <div className="rounded-md bg-muted/60 p-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  A strong answer covers:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {card.ideal_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  How well did you recall it?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    className="border-red-500/40 hover:bg-red-500/10"
                    onClick={() => grade(1)}
                  >
                    😬 Blanked
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-500/40 hover:bg-amber-500/10"
                    onClick={() => grade(3)}
                  >
                    🤔 Hard
                  </Button>
                  <Button
                    variant="outline"
                    className="border-emerald-500/40 hover:bg-emerald-500/10"
                    onClick={() => grade(5)}
                  >
                    😎 Easy
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
