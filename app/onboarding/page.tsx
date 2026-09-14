"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RoleSelect } from "@/components/stacks/RoleSelect";
import { StackPicker } from "@/components/stacks/StackPicker";
import { MAX_STACKS, stackName } from "@/lib/stacks";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EXPERIENCE_LEVELS = [
  {
    value: "beginner",
    label: "Starting from scratch",
    desc: "New to this stack — begin at Foundations",
  },
  {
    value: "intermediate",
    label: "Some experience",
    desc: "Know the basics — start at Intermediate",
  },
  {
    value: "experienced",
    label: "Experienced",
    desc: "Comfortable building — focus on Advanced & interview drills",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [roleId, setRoleId] = useState<string | null>(null);
  const [roleOther, setRoleOther] = useState("");
  const [stackIds, setStackIds] = useState<string[]>([]);
  const [primaryStackId, setPrimaryStackId] = useState<string | null>(null);
  const [experience, setExperience] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [pct, setPct] = useState(0);
  const [stageMsg, setStageMsg] = useState("Starting…");

  // The curriculum is still built per-stack. The primary (or first) selection
  // decides which path gets generated; the rest shape interview questions.
  const curriculumStackId = primaryStackId ?? stackIds[0] ?? null;
  const effectiveStack = curriculumStackId ? stackName(curriculumStackId) : "";

  function fail(message: string) {
    toast.error(message);
    setLoading(false);
    setPct(0);
  }

  async function submit() {
    if (stackIds.length === 0) {
      toast.error("Pick at least one technology.");
      return;
    }
    if (stackIds.length > MAX_STACKS) {
      toast.error(`Pick at most ${MAX_STACKS} technologies.`);
      return;
    }
    if (!roleId) {
      toast.error("Pick your target role.");
      return;
    }
    if (roleId === "other" && !roleOther.trim()) {
      toast.error("Tell us your role.");
      return;
    }

    setLoading(true);
    setPct(2);
    setStageMsg("Saving your profile…");

    // Persist role + stacks first, so they survive even if curriculum
    // generation fails or the user closes the tab mid-build.
    try {
      const save = await fetch("/api/profile/stacks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, roleOther, stackIds, primaryStackId }),
      });
      if (!save.ok) {
        const d = await save.json().catch(() => ({}));
        return fail(d.message || "Couldn't save your selection.");
      }
    } catch {
      return fail("Network error — please try again.");
    }

    setPct(4);
    setStageMsg("Checking for an existing path…");

    let res: Response;
    try {
      res = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stack: effectiveStack, experience }),
      });
    } catch {
      return fail("Network error — please try again.");
    }

    // Cache hit (or error) comes back as plain JSON.
    if (!res.headers.get("content-type")?.includes("ndjson")) {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return fail(
          data.message ||
            (res.status === 429
              ? "AI is busy right now — try again in a minute."
              : "Something went wrong building your path. Try again.")
        );
      }
      setPct(100);
      setStageMsg("Ready");
      router.push(`/prep?c=${data.curriculumId}`);
      return;
    }

    // Cache miss: read the live progress stream (newline-delimited JSON).
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev: {
          stage?: string;
          pct?: number;
          curriculumId?: string;
          error?: string;
          message?: string;
        };
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.error) {
          return fail(ev.message || "Couldn't build your path. Try again.");
        }
        if (typeof ev.pct === "number") setPct(ev.pct);
        if (ev.stage) setStageMsg(ev.stage);
        if (ev.curriculumId) {
          router.push(`/prep?c=${ev.curriculumId}`);
          return;
        }
      }
    }
    // Stream ended without a terminal event.
    fail("The connection dropped while building your path. Please try again.");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Set up your prep path</CardTitle>
          <CardDescription>
            The agent will build a complete scratch-to-expert curriculum for
            your stack — study materials, quizzes and mock interviews included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-3">
            <Label className="text-base">1. What role are you targeting?</Label>
            <RoleSelect
              value={roleId}
              onChange={setRoleId}
              otherValue={roleOther}
              onOtherChange={setRoleOther}
            />
          </section>

          <section className="space-y-3">
            <Label className="text-base">
              2. Which technologies?{" "}
              <span className="text-sm font-normal text-muted-foreground">
                Pick 1–{MAX_STACKS} — one is fine
              </span>
            </Label>
            <StackPicker
              value={stackIds}
              onChange={setStackIds}
              primaryId={primaryStackId}
              onPrimaryChange={setPrimaryStackId}
              roleId={roleId}
            />
            {curriculumStackId && (
              <p className="text-xs text-muted-foreground">
                Your study path will be built for{" "}
                <strong className="text-foreground">{effectiveStack}</strong>
                {stackIds.length > 1 &&
                  " — the rest shape your interview questions"}
                . Star a technology above to make it the one your path is built
                for.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <Label className="text-base">3. Where are you today?</Label>
            <RadioGroup value={experience} onValueChange={setExperience}>
              {EXPERIENCE_LEVELS.map((lvl) => (
                <label
                  key={lvl.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent",
                    experience === lvl.value && "border-primary bg-accent"
                  )}
                >
                  <RadioGroupItem value={lvl.value} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">
                      {lvl.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {lvl.desc}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </section>


          {loading ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{stageMsg}…</span>
                <span className="text-sm font-semibold tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Building your complete {effectiveStack || "stack"} path — levels,
                modules, topics and interview drills. This runs once per stack,
                then it&apos;s cached for everyone.
              </p>
            </div>
          ) : (
            <Button onClick={submit} className="w-full" size="lg">
              Build my prep path
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
