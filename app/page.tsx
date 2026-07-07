import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Scratch → Expert roadmap",
    desc: "Pick your stack and the agent generates a complete curriculum: levels, modules, topics — tailored to where you are today.",
  },
  {
    title: "Study materials on demand",
    desc: "Every topic comes with explanations, annotated code, cheat sheets, curated resources and likely interview questions.",
  },
  {
    title: "Voice mock interviews",
    desc: "Speak your answers. A realistic AI interviewer asks follow-ups, scores every answer, and never reveals the rubric mid-round.",
  },
  {
    title: "Report cards & progress",
    desc: "Per-answer feedback, model answers, strengths and weaknesses — with links back to the exact topics to restudy.",
  },
  {
    title: "Always current",
    desc: "A daily pipeline ingests fresh tech news so your interviewer knows about last week's framework release.",
  },
  {
    title: "Free forever",
    desc: "Built entirely on free tiers. When daily AI quota runs out, Practice Mode keeps you learning from cached material.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-20">
      <div className="text-center space-y-5">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          PrepPilot
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-balance">
          Your AI interview agent, from first lesson to final round
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-balance">
          Sign in, choose your stack, and the agent prepares everything — a
          scratch-to-expert study path, materials, quizzes, and realistic
          voice-based mock interviews with detailed feedback.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/login">Get started free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-base">{f.title}</CardTitle>
              <CardDescription>{f.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
