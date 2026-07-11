import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { WhiteboardRoom } from "@/components/interview/WhiteboardRoom";

const DEFAULT_PROMPTS = [
  "Design a URL shortener (like bit.ly) that handles 100M links and high read traffic.",
  "Design the backend for a photo-sharing feed (like Instagram) at scale.",
  "Design a rate limiter for a public API.",
  "Design a real-time chat system for millions of users.",
  "Design a scalable notification service (email + push).",
];

export default async function WhiteboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Prefer a real system-design question from the bank; fall back to defaults.
  const { data: fromBank } = await supabase
    .from("question_bank")
    .select("question")
    .eq("round_type", "system_design")
    .limit(20);

  const pool =
    fromBank && fromBank.length > 0
      ? fromBank.map((q) => q.question as string)
      : DEFAULT_PROMPTS;
  const question = pool[Math.floor(Math.random() * pool.length)];

  return (
    <>
      <AppNav />
      <WhiteboardRoom question={question} />
    </>
  );
}
