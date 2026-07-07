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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STACK_PRESETS = [
  "React + TypeScript",
  "React + Node.js (Full-Stack)",
  "Node.js + Express (Backend)",
  "Python + Django",
  "Python (Data Science & ML)",
  "Java + Spring Boot",
  "Go (Backend)",
  "DevOps (Docker, Kubernetes, AWS)",
];

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
  const [stack, setStack] = useState<string>("");
  const [customStack, setCustomStack] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [targetRole, setTargetRole] = useState("");
  const [loading, setLoading] = useState(false);

  const effectiveStack = stack === "__custom__" ? customStack.trim() : stack;

  async function submit() {
    if (!effectiveStack) {
      toast.error("Pick a stack (or type your own)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stack: effectiveStack,
          experience,
          targetRole: targetRole.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          toast.error(
            data.message ||
              "AI is busy right now — please try again in a minute."
          );
        } else {
          toast.error("Something went wrong building your path. Try again.");
        }
        setLoading(false);
        return;
      }
      router.push(`/prep?c=${data.curriculumId}`);
    } catch {
      toast.error("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
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
            <Label className="text-base">1. Choose your stack</Label>
            <div className="grid grid-cols-2 gap-2">
              {STACK_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStack(p)}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent",
                    stack === p && "border-primary bg-accent"
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStack("__custom__")}
                className={cn(
                  "rounded-md border border-dashed p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent",
                  stack === "__custom__" && "border-primary bg-accent"
                )}
              >
                Something else…
              </button>
            </div>
            {stack === "__custom__" && (
              <Input
                placeholder="e.g. Rust + WebAssembly, Flutter, Android/Kotlin…"
                value={customStack}
                onChange={(e) => setCustomStack(e.target.value)}
                maxLength={80}
                autoFocus
              />
            )}
          </section>

          <section className="space-y-3">
            <Label className="text-base">2. Where are you today?</Label>
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

          <section className="space-y-3">
            <Label htmlFor="role" className="text-base">
              3. Target role <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="role"
              placeholder="e.g. Senior Frontend Engineer at a startup"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              maxLength={120}
            />
          </section>

          <Button
            onClick={submit}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading
              ? "The agent is building your path… (~30s)"
              : "Build my prep path"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
