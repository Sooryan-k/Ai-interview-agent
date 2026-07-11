import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
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
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spaced repetition — questions resurface right before you&apos;d
            forget them. {total ?? 0} card{(total ?? 0) === 1 ? "" : "s"} in your
            deck.
          </p>
        </div>
        <PracticeDeck initialCards={cards} totalCards={total ?? 0} />
      </main>
    </>
  );
}
