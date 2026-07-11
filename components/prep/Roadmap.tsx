import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Curriculum } from "@/lib/schemas";

type TopicStatusMap = Record<string, "todo" | "learning" | "mastered">;

const STATUS_DOT: Record<string, string> = {
  todo: "bg-muted-foreground/30",
  learning: "bg-amber-500",
  mastered: "bg-emerald-500",
};

type QuizScoreMap = Record<string, { pct: number }>;

export function Roadmap({
  curriculumId,
  structure,
  topicStatus,
  currentLevel,
  quizScores = {},
}: {
  curriculumId: string;
  structure: Curriculum;
  topicStatus: TopicStatusMap;
  currentLevel: number;
  quizScores?: QuizScoreMap;
}) {
  return (
    <Accordion
      defaultValue={[
        structure.levels[currentLevel]?.key ?? structure.levels[0].key,
      ]}
      className="space-y-3"
    >
      {structure.levels.map((level, levelIdx) => {
        const topics = level.modules.flatMap((m) => m.topics);
        const mastered = topics.filter(
          (t) => topicStatus[t.key] === "mastered"
        ).length;
        const pct = topics.length ? (mastered / topics.length) * 100 : 0;

        return (
          <AccordionItem
            key={level.key}
            value={level.key}
            className="rounded-lg border px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center gap-4 pr-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
                  {levelIdx + 1}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{level.title}</span>
                    {levelIdx === currentLevel && (
                      <Badge variant="secondary">You are here</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {level.summary}
                  </p>
                </div>
                <div className="hidden w-32 shrink-0 items-center gap-2 sm:flex">
                  <Progress value={pct} className="h-1.5" />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {mastered}/{topics.length}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {level.modules.map((mod) => (
                <div key={mod.key}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      {mod.title}
                    </h4>
                    <Link
                      href={`/prep/quiz/${mod.key}?c=${curriculumId}`}
                      className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {quizScores[mod.key] ? (
                        <Badge
                          variant={
                            quizScores[mod.key].pct >= 80
                              ? "default"
                              : "secondary"
                          }
                          className="tabular-nums"
                        >
                          quiz {quizScores[mod.key].pct}%
                        </Badge>
                      ) : (
                        <>📝 Checkpoint quiz</>
                      )}
                    </Link>
                  </div>
                  <ul className="space-y-1">
                    {mod.topics.map((topic) => {
                      const status = topicStatus[topic.key] ?? "todo";
                      return (
                        <li key={topic.key}>
                          <Link
                            href={`/prep/topic/${topic.key}?c=${curriculumId}`}
                            className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-accent"
                          >
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                STATUS_DOT[status]
                              )}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm">
                                {topic.title}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {topic.objective}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              ~{topic.est_minutes}m
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/interview/new?c=${curriculumId}&level=${levelIdx}`}
                    >
                      Take the {level.title} mock interview →
                    </Link>
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
