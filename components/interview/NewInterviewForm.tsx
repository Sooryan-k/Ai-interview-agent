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
import {
  BadgeDollarSign,
  Flame,
  FolderGit2,
  ListChecks,
  Mic,
  TrendingDown,
  Users,
} from "lucide-react";
import { describePlan, plannedQuestionsFor } from "@/lib/interview-plan";
import { cn } from "@/lib/utils";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";
import { VoicePicker } from "@/components/interview/VoicePicker";
import { InterviewStackField } from "@/components/interview/InterviewStackField";
import { toast } from "sonner";

const ROUNDS = [
  { value: "technical", label: "Technical (concepts & follow-ups)" },
  { value: "behavioral", label: "Behavioral (STAR)" },
  { value: "system_design", label: "System design" },
  { value: "dsa", label: "DSA (verbal, no coding)" },
  { value: "hr", label: "HR screen" },
  { value: "negotiation", label: "Salary negotiation sim" },
  { value: "depth", label: "Depth ladder — find your ceiling" },
  { value: "repo", label: "Interview me on my own code" },
];

const DIFFICULTIES = [
  { value: "easy", label: "Easy — warm-up" },
  { value: "medium", label: "Medium — real screen" },
  { value: "hard", label: "Hard — senior bar" },
];

export function NewInterviewForm({
  defaultStackIds,
  defaultCustom,
  suggestedStackIds,
  primaryStackId,
  roleId,
  curriculumId,
  level,
  levelTitle,
  defaultRoundType,
}: {
  /** Catalog ids preselected in the stack field. */
  defaultStackIds: string[];
  /** Free-text part of the default label the catalog couldn't resolve. */
  defaultCustom: string;
  /** The user's saved profile stacks, offered as one-tap suggestions. */
  suggestedStackIds: string[];
  primaryStackId?: string | null;
  roleId?: string | null;
  curriculumId?: string;
  level?: number;
  levelTitle?: string;
  /** Preselects a round when linked to as /interview/new?round=repo */
  defaultRoundType?: string;
}) {
  const router = useRouter();
  const [roleTrack, setRoleTrack] = useState("");
  const [stackIds, setStackIds] = useState<string[]>(defaultStackIds);
  const [roundType, setRoundType] = useState(() =>
    ROUNDS.some((r) => r.value === defaultRoundType)
      ? (defaultRoundType as string)
      : "technical"
  );
  const [difficulty, setDifficulty] = useState("medium");
  const [jdText, setJdText] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [depthTopic, setDepthTopic] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [barRaiser, setBarRaiser] = useState(false);
  const [panel, setPanel] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mirrors the server's rule exactly (same module), so the number shown here
  // is the number the interview is created with.
  const planArgs = { roundType, difficulty, stackIds };
  const plannedQuestions = plannedQuestionsFor(planArgs);
  const plan = describePlan(planArgs);

  async function start() {
    if (!roleTrack.trim()) {
      toast.error("Pick at least one technology for this interview.");
      return;
    }
    if (roundType === "repo" && !repoUrl.trim()) {
      toast.error("Paste a public GitHub repo URL to be interviewed on.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTrack: roleTrack.trim(),
          stackIds,
          roundType,
          difficulty,
          curriculumId,
          level,
          jdText: jdText.trim() || undefined,
          currency: roundType === "negotiation" ? currency : undefined,
          depthTopic:
            roundType === "depth" ? depthTopic.trim() || undefined : undefined,
          repoUrl: roundType === "repo" ? repoUrl.trim() : undefined,
          barRaiser,
          panel,
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
          <Label>Role / stack</Label>
          <InterviewStackField
            defaultStackIds={defaultStackIds}
            defaultCustom={defaultCustom}
            suggestedIds={suggestedStackIds}
            primaryStackId={primaryStackId}
            roleId={roleId}
            onChange={setRoleTrack}
            onStacksChange={setStackIds}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Round type</Label>
            <Select
              value={roundType}
              onValueChange={(v) => v && setRoundType(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => ROUNDS.find((r) => r.value === v)?.label ?? String(v)}
                </SelectValue>
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
            <Select
              value={difficulty}
              onValueChange={(v) => v && setDifficulty(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) =>
                    DIFFICULTIES.find((d) => d.value === v)?.label ?? String(v)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Mic className="size-4 text-primary" /> Interviewer voice
          </Label>
          <VoicePicker />
          <p className="text-xs text-muted-foreground">
            Remembered on this device — change it anytime from the interview
            room or Settings.
          </p>
        </div>

        {roundType === "depth" && (
          <div className="space-y-1.5">
            <Label htmlFor="depth-topic" className="flex items-center gap-1.5">
              <TrendingDown className="size-4 text-primary" /> Topic to drill
              into{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="depth-topic"
              value={depthTopic}
              onChange={(e) => setDepthTopic(e.target.value)}
              placeholder="e.g. database indexing, React re-renders, TCP"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              One topic, questions that get harder every rung, stopping the
              moment you can&apos;t go deeper — then it tells you exactly where
              your ceiling is. Leave blank and the interviewer picks a topic
              for your stack.
            </p>
          </div>
        )}

        {roundType === "repo" && (
          <div className="space-y-1.5">
            <Label htmlFor="repo-url" className="flex items-center gap-1.5">
              <FolderGit2 className="size-4 text-primary" /> Public GitHub repo
            </Label>
            <Input
              id="repo-url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/your-project"
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              The interviewer reads your actual code — structure, README and
              key files — then asks why you built it that way. Must be a public
              repo.
            </p>
          </div>
        )}

        {roundType === "negotiation" && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <BadgeDollarSign className="size-4 text-primary" /> Currency
            </Label>
            <Select
              value={currency}
              onValueChange={(v) => v && setCurrency(v as typeof currency)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v) => {
                    const c = CURRENCIES.find((x) => x.code === v);
                    return c ? `${c.symbol} ${c.label}` : String(v);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The offer, counters and every figure the recruiter mentions will
              be in this currency.
            </p>
          </div>
        )}

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

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent",
            barRaiser && "border-primary bg-accent"
          )}
        >
          <input
            type="checkbox"
            checked={barRaiser}
            onChange={(e) => setBarRaiser(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Flame className="size-4 text-orange-500" /> Bar-raiser mode
            </span>
            <span className="block text-xs text-muted-foreground">
              A relentlessly demanding interviewer who probes for depth and
              scores strictly. Turn it on when you want the hard version.
            </span>
          </span>
        </label>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent",
            panel && "border-primary bg-accent"
          )}
        >
          <input
            type="checkbox"
            checked={panel}
            onChange={(e) => setPanel(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="size-4 text-primary" /> Panel interview
            </span>
            <span className="block text-xs text-muted-foreground">
              Face three interviewers with different personalities — an
              engineering manager, a senior engineer, and a bar raiser.
            </span>
          </span>
        </label>

        {/* How long this will be — decided by the stack selection, shown before
            they commit to it rather than discovered on question 23. */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm">
            <span className="font-medium">
              {plan.count} {plan.unit}
              {plan.count === 1 ? "" : "s"}
            </span>{" "}
            <span className="text-muted-foreground">— {plan.detail}.</span>
          </p>
        </div>

        <Button onClick={start} disabled={loading} size="lg" className="w-full">
          {loading
            ? roundType === "repo"
              ? "Reading your repository…"
              : "Setting up your interviewer…"
            : `Start ${plannedQuestions}-question interview`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Works best in Chrome/Edge for voice. You can always type instead.
        </p>
      </CardContent>
    </Card>
  );
}
