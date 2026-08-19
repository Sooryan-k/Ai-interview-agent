import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeDollarSign,
  BarChart3,
  Brain,
  Map,
  Mic,
  PenTool,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    icon: Map,
    title: "Scratch → expert roadmap",
    desc: "Pick your stack and the agent generates a complete curriculum — levels, modules and topics tailored to where you are today.",
  },
  {
    icon: Mic,
    title: "Voice mock interviews",
    desc: "Speak your answers. A realistic interviewer asks follow-ups, adapts difficulty, and privately scores every answer.",
  },
  {
    icon: PenTool,
    title: "Whiteboard rounds, graded",
    desc: "Draw a system design and the AI critiques your actual diagram — components, bottlenecks and what's missing.",
  },
  {
    icon: Brain,
    title: "Spaced repetition",
    desc: "Missed questions come back right before you'd forget them. Daily drills and streaks keep the habit alive.",
  },
  {
    icon: BarChart3,
    title: "Delivery coaching",
    desc: "Filler words, pace and pauses tracked across interviews — watch your spoken confidence trend upward.",
  },
  {
    icon: BadgeDollarSign,
    title: "Negotiation simulator",
    desc: "Practice against a recruiter with a hidden budget. Learn to anchor, hold silence, and not leave money on the table.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick your stack",
    desc: "React, Python, DevOps, or anything else — plus where you're starting from.",
  },
  {
    n: "02",
    title: "Learn the path",
    desc: "Study generated materials, take checkpoint quizzes, cram the cheat sheets.",
  },
  {
    n: "03",
    title: "Interview until ready",
    desc: "Voice rounds, coding, whiteboards, panels — with report cards after every one.",
  },
];

export default async function Home() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Target className="size-4" />
            </span>
            <span className="text-sm font-bold tracking-tight">dryrun AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              size="sm"
              variant="ghost"
              render={<Link href="/login">Sign in</Link>}
            />
            <Button
              size="sm"
              render={<Link href="/login">Get started</Link>}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,--theme(--color-primary/8%),transparent)]"
          />
          <div className="mx-auto w-full max-w-4xl px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24 sm:pb-20">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              100% free — no card, no catch
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Your AI interview agent, from first lesson to final round
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground text-balance sm:text-lg">
              Pick your stack and the agent prepares everything — a
              scratch-to-expert study path, quizzes, and realistic voice mock
              interviews with detailed report cards.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                render={<Link href="/login">Start preparing free</Link>}
              />
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                render={<Link href="/dashboard">Open dashboard</Link>}
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Voice works best in Chrome or Edge — typing always works.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Everything between you and the offer
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border bg-background p-5 transition-shadow hover:shadow-sm"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-4.5" />
                  </span>
                  <h3 className="mt-3.5 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Three steps to interview-ready
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="text-center sm:text-left">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {s.n}
                  </span>
                  <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Button
                size="lg"
                render={<Link href="/login">Get started — it&apos;s free</Link>}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
