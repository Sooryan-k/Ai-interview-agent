"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, Target } from "lucide-react";

const PRODUCT_LINKS = [
  { href: "/features", label: "All features" },
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
                dryrun AI
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
              Privacy
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mic className="size-3.5" /> Voice never leaves your browser
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} dryrun AI. Built free, forever.</span>
          <span>Runs entirely on free tiers — no paywalls, no catch.</span>
        </div>
      </div>
    </footer>
  );
}
