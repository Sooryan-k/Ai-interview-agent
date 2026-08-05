"use client";

import { useEffect, useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setUsername(profile?.username ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = username ? username[0].toUpperCase() : "";

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
          <span className="text-sm font-bold tracking-tight">DryRun AI</span>
        </Link>

        {/* Desktop links */}
        <nav className="ml-2 hidden items-center gap-1 md:flex">
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/prep/bank"
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
              }
            />
            <TooltipContent>
              Every question you&apos;ve ever been asked, searchable
            </TooltipContent>
          </Tooltip>
          <ThemeToggle />

          <div
            aria-hidden
            className="mx-1 hidden h-5 w-px bg-border md:block"
          />

          {/* Account menu (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="hidden rounded-full transition-opacity hover:opacity-80 md:flex"
              aria-label="Account menu"
            >
              <Avatar size="sm">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {username && (
                <>
                  <DropdownMenuLabel>@{username}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => router.push("/settings")}
                className="cursor-pointer"
              >
                <Settings data-icon="inline-start" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={signOut}
                variant="destructive"
                className="cursor-pointer"
              >
                <LogOut data-icon="inline-start" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile hamburger */}
          <Tooltip>
            <TooltipTrigger
              render={
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
              }
            />
            <TooltipContent>{open ? "Close menu" : "Open menu"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav className="border-t bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2 sm:px-6">
            {username && (
              <div className="flex items-center gap-2.5 border-b px-3 py-3">
                <Avatar size="sm">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-medium text-foreground">
                    @{username}
                  </span>
                </span>
              </div>
            )}
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
