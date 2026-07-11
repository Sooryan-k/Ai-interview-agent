"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Library,
  LogOut,
  Menu,
  Settings,
  Target,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/prep", label: "Prep" },
  { href: "/practice", label: "Practice" },
  { href: "/stories", label: "Stories" },
  { href: "/interview/new", label: "Interview" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/prep") {
    // Don't light up "Prep" for /prep/bank (it has its own entry).
    return pathname === "/prep" || pathname.startsWith("/prep/topic") ||
      pathname.startsWith("/prep/quiz") || pathname.startsWith("/prep/cram");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2"
          onClick={() => setOpen(false)}
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Target className="size-4" />
          </span>
          <span className="text-sm font-bold tracking-tight">PrepPilot</span>
        </Link>

        {/* Desktop links */}
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(pathname, l.href)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/prep/bank"
            title="Question bank"
            className={cn(
              "hidden rounded-md px-3 py-1.5 text-sm transition-colors md:flex md:items-center md:gap-1.5",
              isActive(pathname, "/prep/bank")
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Library className="size-4" />
            Bank
          </Link>
          <ThemeToggle />
          <Link
            href="/settings"
            title="Settings"
            className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:flex"
          >
            <Settings className="size-4" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="hidden text-muted-foreground md:flex"
          >
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav className="border-t bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2 sm:px-6">
            {[...LINKS, { href: "/prep/bank", label: "Question Bank" }, { href: "/settings", label: "Settings" }].map(
              (l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-sm transition-colors",
                    isActive(pathname, l.href)
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {l.label}
                </Link>
              )
            )}
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
