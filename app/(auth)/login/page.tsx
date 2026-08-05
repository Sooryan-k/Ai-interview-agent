import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/LoginForm";

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
          <Target className="size-5" />
        </span>
        <span className="text-lg font-bold tracking-tight">DryRun AI</span>
      </Link>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
