"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";

export interface PrepPath {
  curriculumId: string;
  label: string;
  total: number;
  mastered: number;
  pct: number;
  levelTitle?: string;
}

export function PrepPathsList({ initial }: { initial: PrepPath[] }) {
  const [paths, setPaths] = useState(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(curriculumId: string) {
    setDeleting(curriculumId);
    try {
      const res = await fetch(`/api/progress/${curriculumId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Couldn't remove — try again.");
        setDeleting(null);
        return;
      }
      setPaths((p) => p.filter((path) => path.curriculumId !== curriculumId));
      toast.success("Removed from your dashboard.");
    } catch {
      toast.error("Network error — try again.");
      setDeleting(null);
    }
  }

  if (paths.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {paths.map((p) => (
        <Card
          key={p.curriculumId}
          className="group relative h-full transition-colors hover:bg-accent/50"
        >
          <Link
            href={`/prep?c=${p.curriculumId}`}
            className="absolute inset-0"
            aria-label={p.label}
          />
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={deleting === p.curriculumId}
                  aria-label={`Remove ${p.label}`}
                  className="absolute top-3 right-3 z-10 text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <Trash2 />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove &quot;{p.label}&quot;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes your progress on this path ({p.mastered}/{p.total}{" "}
                  topics mastered) from your dashboard. The stack itself stays
                  available — starting it again later picks up wherever the
                  curriculum is.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => remove(p.curriculumId)}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <CardHeader>
            <CardTitle className="pr-8 text-base">{p.label}</CardTitle>
            <CardDescription>
              {p.levelTitle ? `Currently: ${p.levelTitle} · ` : ""}
              {p.mastered}/{p.total} topics mastered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Progress value={p.pct} className="h-2" />
              <span className="text-sm font-medium tabular-nums">{p.pct}%</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
