"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface InterviewRow {
  id: string;
  roleTrack: string;
  startedAt: string;
  roundType: string;
  difficulty: string;
  status: string;
  score: number | null;
  href: string;
}

export function RecentInterviews({ initial }: { initial: InterviewRow[] }) {
  const [interviews, setInterviews] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/interview/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete — try again.");
        setDeleting(null);
        return;
      }
      setInterviews((rows) => rows.filter((r) => r.id !== id));
      toast.success("Interview deleted.");
    } catch {
      toast.error("Network error — try again.");
      setDeleting(null);
    }
  }

  if (interviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No interviews yet. Your first mock round takes ~10 minutes — voice
          or text.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {interviews.map((iv) => (
        <div
          key={iv.id}
          className="group relative flex items-center gap-3 p-4 transition-colors hover:bg-accent/50"
        >
          <Link
            href={iv.href}
            className="absolute inset-0"
            aria-label={iv.roleTrack}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{iv.roleTrack}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(iv.startedAt).toLocaleDateString("en-US")} ·{" "}
              {iv.roundType.replace("_", " ")} · {iv.difficulty}
            </p>
          </div>
          {iv.score != null ? (
            <span
              className={cn(
                "relative shrink-0 text-lg font-bold tabular-nums",
                iv.score >= 75
                  ? "text-emerald-600 dark:text-emerald-400"
                  : iv.score >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              )}
            >
              {iv.score}
            </span>
          ) : (
            <Badge
              variant={iv.status === "active" ? "default" : "secondary"}
              className="relative shrink-0"
            >
              {iv.status === "active" ? "Resume" : iv.status}
            </Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={deleting === iv.id}
                  aria-label={`Delete interview: ${iv.roleTrack}`}
                  className="relative z-10 shrink-0 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <Trash2 />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this interview?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the transcript, evaluation and
                  report for this {iv.roleTrack} interview. This can&apos;t be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => remove(iv.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}
