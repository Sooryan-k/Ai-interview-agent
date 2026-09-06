import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to dryrun AI with a magic link or Google — no password needed — and pick up your interview prep where you left off.",
  alternates: { canonical: "/login" },
};

export default async function LoginPage() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,--theme(--color-primary/8%),transparent)]"
      />
      <Link href="/" className="relative flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
          <BrandMark className="size-5" />
        </span>
        <span className="text-lg font-bold tracking-tight">dryrun AI</span>
      </Link>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
