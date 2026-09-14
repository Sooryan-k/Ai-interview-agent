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
import { Check, Circle, Loader2, X } from "lucide-react";
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

type BuildOutcome =
  | { ok: true; curriculumId: string; cached: boolean }
  | { ok: false; message: string; stopEverything: boolean };

/**
 * Builds (or fetches from the global cache) one technology's study path.
 *
 * A cache hit comes back as plain JSON and costs nothing; a miss streams
 * newline-delimited progress events. Both end with a curriculum id.
 */
async function buildOne(
  stack: string,
  experience: string,
  onProgress: (pct: number, stage?: string) => void
): Promise<BuildOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/curriculum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stack, experience }),
    });
  } catch {
    return { ok: false, message: "Network error.", stopEverything: false };
  }

  if (!res.headers.get("content-type")?.includes("ndjson")) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        message:
          data.message ||
          (res.status === 429
            ? "AI is busy right now — try again in a minute."
            : "Something went wrong building this path."),
        // A spent daily budget or a rate limit applies to every stack.
        stopEverything: res.status === 429,
      };
    }
    onProgress(100);
    return { ok: true, curriculumId: data.curriculumId, cached: true };
  }

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
        return {
          ok: false,
          message: ev.message || "Couldn't build this path.",
          stopEverything: ev.error === "rate_limit" || ev.error === "quota",
        };
      }
      if (typeof ev.pct === "number") onProgress(ev.pct, ev.stage);
      if (ev.curriculumId) {
        return { ok: true, curriculumId: ev.curriculumId, cached: false };
      }
    }
  }
  return {
    ok: false,
    message: "The connection dropped while building this path.",
    stopEverything: false,
  };
}

export interface OnboardingInitial {
  roleId: string | null;
  roleOther: string;
  stackIds: string[];
  primaryStackId: string | null;
  /** Curriculum ids the user already has, keyed by the stack they were built for. */
  existingStackIds: string[];
}

type BuildStatus = "pending" | "building" | "done" | "failed";

interface StackBuild {
  stackId: string;
  name: string;
  status: BuildStatus;
  curriculumId?: string;
  /** True when it came straight from the global cache — no AI call needed. */
  cached?: boolean;
  error?: string;
}

export function OnboardingForm({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter();
  const [roleId, setRoleId] = useState<string | null>(initial.roleId);
  const [roleOther, setRoleOther] = useState(initial.roleOther);
  // Prefilled from the profile so returning here to add a technology extends
  // the selection instead of replacing it — the save is a full overwrite.
  const [stackIds, setStackIds] = useState<string[]>(initial.stackIds);
  const [primaryStackId, setPrimaryStackId] = useState<string | null>(
    initial.primaryStackId
  );
  const [experience, setExperience] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [pct, setPct] = useState(0);
  const [stageMsg, setStageMsg] = useState("Starting…");
  const [builds, setBuilds] = useState<StackBuild[]>([]);

  // Every selected technology gets its own study path. The primary one is
  // built first so it's the path we land on, and so a mid-run quota stop
  // leaves them holding the one they care about most.
  const buildOrder = primaryStackId
    ? [primaryStackId, ...stackIds.filter((id) => id !== primaryStackId)]
    : stackIds;

  /** Selected technologies that don't have a study path yet. */
  const newStacks = stackIds.filter(
    (id) => !initial.existingStackIds.includes(id)
  );

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

    // One path per technology, built in order. Each is independent: a failure
    // on stack 4 doesn't discard the three already built, because those are
    // already saved and enrolled server-side by the time we hear back.
    const results: StackBuild[] = buildOrder.map((stackId) => ({
      stackId,
      name: stackName(stackId) ?? stackId,
      status: "pending",
    }));
    setBuilds(results);

    const total = results.length;
    const update = (i: number, patch: Partial<StackBuild>) => {
      results[i] = { ...results[i], ...patch };
      setBuilds([...results]);
    };
    // Overall progress spans all stacks: each one owns a 1/total slice.
    const overall = (i: number, within: number) =>
      setPct(Math.min(99, Math.round(((i + within / 100) / total) * 100)));

    for (let i = 0; i < total; i++) {
      const build = results[i];
      update(i, { status: "building" });
      setStageMsg(
        total === 1
          ? `Building your ${build.name} path`
          : `Building ${build.name} (${i + 1} of ${total})`
      );
      overall(i, 0);

      // /api/curriculum is idempotent — an existing path returns instantly
      // from the global cache and simply re-enrols. No need to special-case
      // technologies the user already has.
      const outcome = await buildOne(build.name, experience, (within, stage) => {
        overall(i, within);
        if (stage) setStageMsg(`${build.name}: ${stage}`);
      });

      if (outcome.ok) {
        update(i, {
          status: "done",
          curriculumId: outcome.curriculumId,
          cached: outcome.cached,
        });
      } else {
        update(i, { status: "failed", error: outcome.message });
        // A spent budget or a rate limit will hit every remaining stack the
        // same way — stop rather than burning through nine more failures.
        if (outcome.stopEverything) {
          for (let j = i + 1; j < total; j++) {
            update(j, {
              status: "failed",
              error: "Not attempted — the AI budget ran out first.",
            });
          }
          break;
        }
      }
    }

    const built = results.filter((r) => r.status === "done");
    if (built.length === 0) {
      return fail(
        results[0]?.error ||
          "Couldn't build your study paths right now. Please try again."
      );
    }

    setPct(100);
    setStageMsg("Ready");

    if (built.length < total) {
      const missing = results.filter((r) => r.status === "failed");
      toast.warning(
        `Built ${built.length} of ${total} paths. ${missing
          .map((m) => m.name)
          .join(", ")} didn't finish — open "New stack" from your prep page to retry.`
      );
    } else if (total > 1) {
      toast.success(`Built ${total} study paths — one per technology.`);
    }

    // Land on the primary path; the rest are reachable from the switcher.
    const landing =
      built.find((b) => b.stackId === buildOrder[0]) ?? built[0];
    router.push(`/prep?c=${landing.curriculumId}`);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Set up your prep path</CardTitle>
          <CardDescription>
            The agent builds a complete scratch-to-expert curriculum for every
            technology you pick — study materials, quizzes and mock interviews
            included.
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
            {newStacks.length > 0 && initial.existingStackIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {newStacks.length} new path
                {newStacks.length === 1 ? "" : "s"} to build (
                {newStacks.map((id) => stackName(id)).join(", ")}). The rest you
                already have — they&apos;ll open instantly.
              </p>
            )}
            {stackIds.length > 0 && initial.existingStackIds.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {stackIds.length === 1 ? (
                  <>
                    You&apos;ll get a full study path for{" "}
                    <strong className="text-foreground">
                      {stackName(stackIds[0])}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    You&apos;ll get{" "}
                    <strong className="text-foreground">
                      {stackIds.length} separate study paths
                    </strong>
                    , one per technology. Star one to decide which opens first.
                  </>
                )}
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
              {/* One row per technology, so a multi-stack build shows what's
                  already banked rather than one bar that means nothing. */}
              {builds.length > 1 && (
                <ul className="space-y-1.5 border-t pt-3">
                  {builds.map((b) => (
                    <li
                      key={b.stackId}
                      className="flex items-center gap-2 text-xs"
                    >
                      {b.status === "done" ? (
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : b.status === "failed" ? (
                        <X className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                      ) : b.status === "building" ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                      ) : (
                        <Circle className="size-3.5 shrink-0 text-muted-foreground/40" />
                      )}
                      <span
                        className={cn(
                          b.status === "pending" && "text-muted-foreground",
                          b.status === "done" && "font-medium"
                        )}
                      >
                        {b.name}
                      </span>
                      {b.cached && (
                        <span className="text-muted-foreground">
                          — ready instantly
                        </span>
                      )}
                      {b.error && (
                        <span className="min-w-0 truncate text-muted-foreground">
                          — {b.error}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted-foreground">
                Each path is a full curriculum — levels, modules, topics and
                interview drills. A technology someone else has already studied
                is ready instantly; the rest are built once, then cached for
                everyone.
              </p>
            </div>
          ) : (
            <Button
              onClick={submit}
              className="w-full"
              size="lg"
              disabled={stackIds.length === 0}
            >
              {stackIds.length > 1
                ? `Build my ${stackIds.length} prep paths`
                : "Build my prep path"}
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
