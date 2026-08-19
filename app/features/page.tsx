import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  Code2,
  Download,
  FileText,
  Flame,
  FolderGit2,
  Footprints,
  Library,
  Link2,
  Map,
  Mic,
  PenTool,
  Sparkles,
  Target,
  TrendingDown,
  Trophy,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Features — dryrun AI",
  description:
    "Every feature in dryrun AI, explained: prep paths, voice/whiteboard/coding interviews, negotiation sims, analytics, streaks and more.",
};

interface Feature {
  icon: typeof Map;
  title: string;
  desc: string;
  href: string;
}

const PREP: Feature[] = [
  {
    icon: Map,
    title: "Scratch → expert roadmap",
    desc: "Pick a stack (React, Python, DevOps — anything) and tell it where you're starting from. The agent generates a full curriculum: levels, modules and topics, sequenced so each one builds on the last.",
    href: "/onboarding",
  },
  {
    icon: FileText,
    title: "Generated study material & cheat sheets",
    desc: "Every topic in your roadmap comes with written study notes and a one-page cheat sheet you can skim right before an interview — generated once per topic and reused for everyone, so it costs nothing to keep revisiting.",
    href: "/prep",
  },
  {
    icon: BookOpen,
    title: "Checkpoint quizzes & cram sheets",
    desc: "Short multiple-choice quizzes after each module confirm you actually absorbed it, and a cram-sheet view compresses an entire level into last-minute review material.",
    href: "/prep",
  },
  {
    icon: Library,
    title: "Question bank",
    desc: "A searchable, filterable bank of every interview question the app has ever asked — across all users. Browse by round type or difficulty and drop any question straight into your practice deck.",
    href: "/prep/bank",
  },
  {
    icon: Zap,
    title: "Daily drill & spaced repetition",
    desc: "One 60-second question a day keeps the habit alive. Questions you got wrong resurface on a spaced-repetition schedule — right before you'd naturally forget them, not on a fixed calendar.",
    href: "/practice",
  },
  {
    icon: FileText,
    title: "Resume-aware prep",
    desc: "Upload your resume and the agent reads it — prep topics, interview questions, and even negotiation context can tailor themselves to your actual background instead of generic questions.",
    href: "/settings",
  },
];

const INTERVIEW: Feature[] = [
  {
    icon: FolderGit2,
    title: "Interview me on my own code",
    desc: "Paste a public GitHub repo and the interviewer reads it — file tree, README, key source files — then asks why you built it that way. Real interviewers spend half the loop on your project; this is the only way to rehearse defending code you actually wrote.",
    href: "/interview/new?round=repo",
  },
  {
    icon: TrendingDown,
    title: "Depth ladder — find your ceiling",
    desc: "One topic, drilled deeper every rung — mechanism, trade-offs, failure modes, internals — stopping the moment you can't go further. Ends by naming the exact concept that stopped you, because depth is what gets people rejected, not breadth.",
    href: "/interview/new?round=depth",
  },
  {
    icon: Mic,
    title: "Voice mock interviews",
    desc: "A realistic interviewer speaks the question out loud, listens to your spoken answer, and asks real follow-ups based on what you actually said — not a fixed script. Typing works too if you'd rather not talk.",
    href: "/interview/new",
  },
  {
    icon: Footprints,
    title: "Walk mode (hands-free)",
    desc: "Turn this on and the whole interview runs hands-free: the interviewer speaks, the mic auto-listens for your reply, and it auto-submits after a few seconds of silence — good for pacing back and forth while you think out loud.",
    href: "/interview/new",
  },
  {
    icon: PenTool,
    title: "Whiteboard rounds",
    desc: "Draw your system design on an open canvas — boxes, arrows, whatever you'd sketch on a real whiteboard. The AI actually looks at your diagram (not just a text description) and critiques the components, bottlenecks and missing pieces.",
    href: "/interview/whiteboard",
  },
  {
    icon: Code2,
    title: "Coding rounds",
    desc: "A real in-browser code editor with multiple language support. Run your solution against test cases, then get an AI review covering correctness, time/space complexity, and a cleaner approach than what you wrote.",
    href: "/interview/coding",
  },
  {
    icon: Flame,
    title: "Bar-raiser mode",
    desc: "An optional, meaner version of the interviewer — relentlessly probes for depth and scores strictly. Turn it on when you want the version that doesn't go easy on you.",
    href: "/interview/new",
  },
  {
    icon: Users,
    title: "Panel interviews",
    desc: "Face three interviewer personalities in the same session — an engineering manager, a senior engineer, and a bar raiser — each with a different angle on your answers, the way a real onsite loop actually feels.",
    href: "/interview/new",
  },
  {
    icon: BadgeDollarSign,
    title: "Salary negotiation simulator",
    desc: "Practice the offer conversation against a recruiter persona with a hidden budget, in your currency of choice (USD, EUR, GBP, INR and more). Learn to anchor a number, hold silence after asking, and not leave money on the table — before it's a real offer.",
    href: "/interview/new?round=negotiation",
  },
];

const PROGRESS: Feature[] = [
  {
    icon: ClipboardList,
    title: "Report cards",
    desc: "Every interview ends with a full breakdown: an overall score, strengths, weaknesses, and a per-question comparison between your answer summary and a model answer.",
    href: "/dashboard",
  },
  {
    icon: Link2,
    title: "Shareable reports",
    desc: "Turn any report card into a read-only link you can send to a mentor, a friend, or a study group — no login required to view it.",
    href: "/dashboard",
  },
  {
    icon: BarChart3,
    title: "Delivery coaching",
    desc: "Filler words, hedging language (\"I think\", \"maybe\"), speaking pace and pauses are tracked automatically across your voice interviews, so you can watch your spoken confidence trend upward over time — not just your answer content.",
    href: "/dashboard",
  },
  {
    icon: Volume2,
    title: "Speech clarity score",
    desc: "Your browser's own speech engine reports how confidently it understood each phrase — a free proxy for how intelligible you actually sounded. If the recognizer struggled with your technical terms, an interviewer on a video call would too.",
    href: "/dashboard",
  },
  {
    icon: Target,
    title: "Skill radar",
    desc: "Your average answer score broken down by skill (communication, problem-solving, system design, and more), plotted so you can see your shape at a glance.",
    href: "/dashboard",
  },
  {
    icon: TrendingDown,
    title: "Weakness heatmap",
    desc: "A skill × interview grid showing exactly where you're weakest and whether it's improving or not — computed entirely from evaluations you already have, no extra AI calls.",
    href: "/dashboard",
  },
];

const HABIT: Feature[] = [
  {
    icon: Trophy,
    title: "Streaks, XP & badges",
    desc: "Daily streaks for showing up, XP for real study actions (interviews, quizzes, mastered topics, drills), and unlockable badges like \"Week Warrior\" or \"Quiz Master\" for hitting milestones.",
    href: "/dashboard",
  },
  {
    icon: Brain,
    title: "Story bank",
    desc: "Turn your real work experiences into polished STAR-format stories. In behavioral rounds, the interviewer references and probes these directly — so practice actually feels like the real thing instead of generic hypotheticals.",
    href: "/stories",
  },
  {
    icon: CalendarDays,
    title: "Study plan export",
    desc: "Download a two-week .ics calendar built from your unfinished topics, with a daily study block already scheduled. Import it straight into Google or Apple Calendar and let it remind you.",
    href: "/settings",
  },
  {
    icon: Bell,
    title: "Daily reminders",
    desc: "An opt-in, once-a-day browser nudge to keep your streak alive — fires only when you'd normally have the app open, no background tracking or push subscriptions.",
    href: "/settings",
  },
];

const PLATFORM: Feature[] = [
  {
    icon: Sparkles,
    title: "100% free, no catch",
    desc: "The whole app runs on free-tier infrastructure end to end. No paywalls, no credit card, no \"premium\" tier hiding the features that actually matter.",
    href: "/",
  },
  {
    icon: Mic,
    title: "Voice stays in your browser",
    desc: "Speech recognition and text-to-speech both run using your browser's built-in APIs. Your voice audio is never uploaded or stored anywhere — only the transcribed text is sent for scoring.",
    href: "/interview/new",
  },
  {
    icon: Download,
    title: "Installable & works offline",
    desc: "Install dryrun AI to your home screen like a native app. Pages you've already visited keep working without a connection, so you can review study material anywhere.",
    href: "/settings",
  },
];

function FeatureGroup({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: Feature[];
}) {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {title}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border bg-background p-5 transition-colors hover:border-primary/40 hover:bg-accent/50"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-4.5" />
              </span>
              <h3 className="mt-3.5 flex items-center gap-1 text-sm font-semibold">
                {f.title}
                <ArrowRight className="size-3.5 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col">
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
              render={<Link href="/login">Get started</Link>}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,--theme(--color-primary/8%),transparent)]"
          />
          <div className="mx-auto w-full max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24 sm:pb-14">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Everything inside dryrun AI
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground text-balance sm:text-lg">
              One prep path, four interview formats, and the analytics to
              show whether it's working — all free. Here's what each piece
              actually does.
            </p>
          </div>
        </section>

        <FeatureGroup
          eyebrow="Prep & learning"
          title="Go from scratch to expert-ready"
          items={PREP}
        />
        <FeatureGroup
          eyebrow="Interview modes"
          title="Every round a real interview loop throws at you"
          items={INTERVIEW}
        />
        <FeatureGroup
          eyebrow="After every interview"
          title="See exactly where you stand"
          items={PROGRESS}
        />
        <FeatureGroup
          eyebrow="Staying consistent"
          title="Built to keep you coming back"
          items={HABIT}
        />
        <FeatureGroup
          eyebrow="Platform"
          title="Free, private, and works anywhere"
          items={PLATFORM}
        />

        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Ready to try it?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Pick a stack and start your first prep path in under a minute.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="w-full sm:w-auto"
                render={<Link href="/login">Start preparing free</Link>}
              />
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                render={<Link href="/">Back home</Link>}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
