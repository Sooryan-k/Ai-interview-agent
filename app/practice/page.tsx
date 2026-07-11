import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { PageShell } from "@/components/PageShell";
import { PracticeDeck } from "@/components/practice/PracticeDeck";

interface DueCard {
  id: string;
  question: string;
  ideal_points: string[];
  tags: string[];
  round_type?: string;
}

export default async function PracticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: due }, { count: total }] = await Promise.all([
    supabase
      .from("user_question_stats")
      .select(
        "question_id, question_bank (id, question, ideal_points, tags, round_type)"
      )
      .eq("user_id", user.id)
      .lte("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(30),
    supabase
      .from("user_question_stats")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const cards: DueCard[] = (due ?? [])
    .map((row) => {
      const qb = Array.isArray(row.question_bank)
        ? row.question_bank[0]
        : row.question_bank;
      return qb as DueCard | null;
    })
    .filter((c): c is DueCard => Boolean(c));

  return (
    <>
      <AppNav />
      <PageShell
        maxWidth="narrow"
        title="Practice"
        description={`Spaced repetition — questions resurface right before you'd forget them. ${total ?? 0} card${(total ?? 0) === 1 ? "" : "s"} in your deck.`}
      >
        <PracticeDeck initialCards={cards} totalCards={total ?? 0} />
      </PageShell>
    </>
  );
}
