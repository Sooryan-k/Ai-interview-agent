"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "@excalidraw/excalidraw/index.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WhiteboardCritique } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Excalidraw is a heavy, browser-only canvas — load it client-side only.
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading whiteboard…</div> }
);

// Minimal shape of the Excalidraw imperative API we use.
type ExcalidrawAPI = {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
};

function scoreColor(s: number) {
  if (s >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (s >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function WhiteboardRoom({ question }: { question: string }) {
  const [api, setApi] = useState<ExcalidrawAPI | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [critique, setCritique] = useState<WhiteboardCritique | null>(null);

  async function submit() {
    if (!api) return;
    const elements = api.getSceneElements();
    if (!elements || elements.length < 2) {
      toast.error("Draw your architecture first — a few boxes and arrows.");
      return;
    }
    setSubmitting(true);
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        elements: elements as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        appState: { ...(api.getAppState() as any), exportBackground: true, exportScale: 1 },
        files: api.getFiles() as never,
        mimeType: "image/png",
        maxWidthOrHeight: 1400,
      });
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/interview/whiteboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, image: dataUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setCritique(data.critique);
      } else {
        toast.error(data.message || "Couldn't grade the diagram — try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong exporting the diagram.");
    } finally {
      setSubmitting(false);
    }
  }

  if (critique) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Whiteboard critique</p>
            <h1 className="text-2xl font-bold tracking-tight">System design</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{question}</p>
          </div>
          <div className="text-center">
            <div className={cn("text-5xl font-bold tabular-nums", scoreColor(critique.overall_score))}>
              {critique.overall_score}
            </div>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </div>

        {critique.components_identified.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {critique.components_identified.map((c) => (
              <Badge key={c} variant="secondary">{c}</Badge>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base text-emerald-600 dark:text-emerald-400">Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {critique.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base text-amber-600 dark:text-amber-400">Bottlenecks</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1.5 pl-5 text-sm">
                {critique.bottlenecks.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Missing pieces</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {critique.missing_pieces.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Interviewer would ask</CardTitle>
            <CardDescription>{critique.verdict}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {critique.follow_up_questions.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-2 pb-6">
          <Button variant="outline" onClick={() => setCritique(null)}>Try again</Button>
          <Button render={<Link href="/dashboard">Back to dashboard</Link>} />
        </div>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="border-b bg-muted/30">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-6 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Design this — then submit for AI critique</p>
            <p className="truncate text-sm font-medium">{question}</p>
          </div>
          <Button onClick={submit} disabled={submitting} className="shrink-0">
            {submitting ? "Grading your diagram…" : "Submit design →"}
          </Button>
        </div>
      </div>
      <div className="min-h-[60vh] flex-1">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Excalidraw excalidrawAPI={(a: any) => setApi(a)} />
      </div>
    </div>
  );
}
