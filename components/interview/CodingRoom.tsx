"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LANGUAGES,
  type CodingProblem,
  type LanguageId,
} from "@/lib/coding";
import type { CodeReview } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

interface TestResult {
  passed: boolean;
  expected: string;
  got: string;
}

export function CodingRoom({ problem }: { problem: CodingProblem }) {
  const [lang, setLang] = useState<LanguageId>("python");
  const [code, setCode] = useState(problem.starters.python);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [review, setReview] = useState<CodeReview | null>(null);

  function switchLang(next: LanguageId) {
    setLang(next);
    setCode(problem.starters[next]);
    setResults(null);
  }

  async function runTests() {
    setRunning(true);
    setResults(null);
    try {
      const out: TestResult[] = [];
      for (const t of problem.tests) {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: lang, source: code, stdin: t.stdin }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message || "Runner error — try again.");
          setRunning(false);
          return;
        }
        const got = (data.stdout ?? "").trim();
        out.push({ passed: got === t.expected.trim(), expected: t.expected, got });
      }
      setResults(out);
    } catch {
      toast.error("Network error running tests.");
    } finally {
      setRunning(false);
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      const passed = results?.filter((r) => r.passed).length ?? 0;
      const res = await fetch("/api/interview/coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem: problem.statement,
          problemTitle: problem.title,
          language: lang,
          source: code,
          testsPassed: passed,
          testsTotal: problem.tests.length,
        }),
      });
      const data = await res.json();
      if (res.ok) setReview(data.review);
      else toast.error(data.message || "Couldn't get a review — try again.");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setFinishing(false);
    }
  }

  if (review) {
    const c = (s: number) =>
      s >= 75 ? "text-emerald-600 dark:text-emerald-400" : s >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
    return (
      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Code review</h1>
          <span className={cn("text-3xl font-bold tabular-nums sm:text-4xl", c(review.overall_score))}>
            {review.overall_score}
          </span>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">Correctness</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{review.correctness}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Complexity</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{review.complexity}</CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Cleaner approach</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{review.cleaner_approach}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {review.improvements.map((im, i) => <li key={i}>{im}</li>)}
            </ul>
          </CardContent>
        </Card>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => setReview(null)}>Keep coding</Button>
          <Button render={<Link href="/dashboard">Back to dashboard</Link>} />
        </div>
      </main>
    );
  }

  const passedCount = results?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
      {/* Problem panel */}
      <div className="max-h-[40vh] overflow-y-auto border-b lg:max-h-none lg:w-2/5 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{problem.title}</h1>
            <Badge variant="outline">{problem.difficulty}</Badge>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
            {problem.statement}
          </pre>
          {results && (
            <div className="space-y-1.5 rounded-md border p-3">
              <p className="text-sm font-medium">
                {passedCount}/{results.length} tests passed
              </p>
              {results.map((r, i) => (
                <div key={i} className="text-xs">
                  <span className={r.passed ? "text-emerald-600" : "text-red-600"}>
                    {r.passed ? "✓" : "✗"} Test {i + 1}
                  </span>
                  {!r.passed && (
                    <span className="text-muted-foreground">
                      {" "}— expected “{r.expected}”, got “{r.got.slice(0, 40)}”
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <div className="flex gap-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                onClick={() => switchLang(l.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  lang === l.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={runTests} disabled={running}>
              {running ? (
                "Running…"
              ) : (
                <>
                  <Play data-icon="inline-start" /> Run tests
                </>
              )}
            </Button>
            <Button size="sm" onClick={finish} disabled={finishing || !results}>
              {finishing ? "Reviewing…" : "Finish & review"}
            </Button>
          </div>
        </div>
        <div className="flex-1">
          <MonacoEditor
            height="100%"
            language={LANGUAGES.find((l) => l.id === lang)?.monaco}
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
