"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Target } from "lucide-react";

const PRODUCT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/prep", label: "Prep path" },
  { href: "/prep/bank", label: "Question bank" },
  { href: "/practice", label: "Practice" },
  { href: "/stories", label: "Story bank" },
];

const INTERVIEW_LINKS = [
  { href: "/interview/new", label: "Mock interview" },
  { href: "/interview/whiteboard", label: "Whiteboard round" },
  { href: "/interview/coding", label: "Coding round" },
  { href: "/settings", label: "Settings" },
];

const GITHUB_URL = "https://github.com/Sooryan-k/Ai-interview-agent";

// Full-height, immersive interview surfaces manage their own viewport and
// shouldn't have a footer trailing beneath the fold.
const IMMERSIVE_PREFIX = "/interview/";
const IMMERSIVE_EXCEPTIONS = new Set(["/interview/new"]);

export function Footer() {
  const pathname = usePathname();
  if (
    pathname.startsWith(IMMERSIVE_PREFIX) &&
    !IMMERSIVE_EXCEPTIONS.has(pathname)
  ) {
    return null;
  }

  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Target className="size-4" />
              </span>
              <span className="text-sm font-bold tracking-tight">
                DryRun AI
              </span>
            </Link>
            <p className="max-w-[26ch] text-sm text-muted-foreground">
              Every interview, rehearsed. Free, forever.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Product
            </h3>
            <ul className="space-y-2">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Interview modes
            </h3>
            <ul className="space-y-2">
              {INTERVIEW_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Project
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3.5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.41-5.26 5.7.42.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
                  </svg>
                  GitHub
                </a>
              </li>
              <li className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mic className="size-3.5" /> Voice never leaves your browser
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} DryRun AI. Built free, forever.</span>
          <span>Runs entirely on free tiers — no paywalls, no catch.</span>
        </div>
      </div>
    </footer>
  );
}
