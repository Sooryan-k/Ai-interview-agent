"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Material {
  content_md: string;
  cheat_sheet_md: string | null;
  resources: { title: string; url: string }[];
  interview_questions: string[];
}

export function StudyContent({
  curriculumId,
  topicKey,
  levelIdx,
  initialMaterial,
  initialStatus,
}: {
  curriculumId: string;
  topicKey: string;
  levelIdx: number;
  initialMaterial: Material | null;
  initialStatus: string;
}) {
  const [material, setMaterial] = useState<Material | null>(initialMaterial);
  const [loading, setLoading] = useState(!initialMaterial);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/study/${topicKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.message ||
            (res.status === 429
              ? "AI quota reached — try again later."
              : "Failed to generate this material. Try again.")
        );
        setLoading(false);
        return;
      }
      setMaterial(data.material);
      setLoading(false);
    } catch {
      setErrorMsg("Network error — please retry.");
      setLoading(false);
    }
  }, [curriculumId, topicKey]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Opening a topic moves it todo -> learning (fire and forget).
    if (status === "todo") {
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculumId,
          topicKey,
          status: "learning",
          onlyIfTodo: true,
        }),
      }).then(() => setStatus("learning"));
    }

    if (!initialMaterial) void generate();
  }, [curriculumId, topicKey, status, initialMaterial, generate]);

  async function markMastered() {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curriculumId, topicKey, status: "mastered" }),
    });
    if (res.ok) {
      setStatus("mastered");
      toast.success("Marked as mastered — it'll show green on your roadmap.");
    } else {
      toast.error("Couldn't update progress.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground animate-pulse">
          The agent is writing this lesson for you… (first visit only — it&apos;s
          cached for everyone afterwards)
        </p>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  if (errorMsg || !material) {
    return (
      <div className="space-y-4 rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">{errorMsg}</p>
        <Button onClick={generate} variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <article className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {material.content_md}
        </ReactMarkdown>
      </article>

      {material.cheat_sheet_md ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">⚡ Pre-interview cheat sheet</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {material.cheat_sheet_md}
            </ReactMarkdown>
          </CardContent>
        </Card>
      ) : null}

      {material.interview_questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Questions an interviewer would ask
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {material.interview_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {material.resources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Free resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {material.resources.map((r) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 border-t pt-6">
        <Button
          onClick={markMastered}
          disabled={status === "mastered"}
          variant={status === "mastered" ? "secondary" : "default"}
        >
          {status === "mastered" ? "✓ Mastered" : "Mark as mastered"}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/interview/new?c=${curriculumId}&level=${levelIdx}`}>
            Practice this in a mock interview →
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/prep?c=${curriculumId}`}>← Back to roadmap</Link>
        </Button>
      </div>
    </div>
  );
}
