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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ROUNDS = [
  { value: "technical", label: "Technical (concepts & follow-ups)" },
  { value: "behavioral", label: "Behavioral (STAR)" },
  { value: "system_design", label: "System design" },
  { value: "dsa", label: "DSA (verbal, no coding)" },
  { value: "hr", label: "HR screen" },
];

export function NewInterviewForm({
  defaultRoleTrack,
  curriculumId,
  level,
  levelTitle,
}: {
  defaultRoleTrack: string;
  curriculumId?: string;
  level?: number;
  levelTitle?: string;
}) {
  const router = useRouter();
  const [roleTrack, setRoleTrack] = useState(defaultRoleTrack);
  const [roundType, setRoundType] = useState("technical");
  const [difficulty, setDifficulty] = useState("medium");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);

  async function start() {
    if (!roleTrack.trim()) {
      toast.error("What role/stack is this interview for?");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTrack: roleTrack.trim(),
          roundType,
          difficulty,
          curriculumId,
          level,
          jdText: jdText.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data.message ||
            "Couldn't start the interview right now — try again shortly."
        );
        setLoading(false);
        return;
      }
      router.push(`/interview/${data.interviewId}`);
    } catch {
      toast.error("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">New mock interview</CardTitle>
        <CardDescription>
          {levelTitle
            ? `Scoped to your "${levelTitle}" level — the interviewer will ask about topics you've been studying.`
            : "A realistic interviewer will ask questions, adapt to your answers, and score you privately."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="role">Role / stack</Label>
          <Input
            id="role"
            value={roleTrack}
            onChange={(e) => setRoleTrack(e.target.value)}
            placeholder="e.g. React + Node.js"
            maxLength={80}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Round type</Label>
            <Select value={roundType} onValueChange={setRoundType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy — warm-up</SelectItem>
                <SelectItem value="medium">Medium — real screen</SelectItem>
                <SelectItem value="hard">Hard — senior bar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="jd">
            Paste a job description{" "}
            <span className="text-muted-foreground">(optional — tailors the questions)</span>
          </Label>
          <Textarea
            id="jd"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Paste the JD you're interviewing for…"
          />
        </div>

        <Button onClick={start} disabled={loading} size="lg" className="w-full">
          {loading ? "Setting up your interviewer…" : "Start interview"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Works best in Chrome/Edge for voice. You can always type instead.
        </p>
      </CardContent>
    </Card>
  );
}
