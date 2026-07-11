"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/prep", label: "Prep" },
  { href: "/practice", label: "Practice" },
  { href: "/stories", label: "Stories" },
  { href: "/interview/new", label: "Interview" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-bold">
            PrepPilot
          </Link>
          <nav className="flex items-center gap-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "text-sm text-muted-foreground transition-colors hover:text-foreground",
                  pathname.startsWith(l.href) && "text-foreground font-medium"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/prep/bank"
            className="hidden rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            title="Question bank"
          >
            Bank
          </Link>
          <Link
            href="/settings"
            className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            title="Settings"
          >
            ⚙
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
