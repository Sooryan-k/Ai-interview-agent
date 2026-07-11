import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reviewCard } from "@/lib/sm2";
import { touchStreak } from "@/lib/streak";

/**
 * Spaced-repetition practice. Zero Gemini calls.
 * GET                                   → all due cards (question_bank joined)
 * POST { action:'enroll', questionId }  → add a card (due now)
 * POST { action:'review', questionId, quality:0-5 } → SM-2 update
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: due } = await supabase
    .from("user_question_stats")
    .select(
      "question_id, ease, interval_days, lapses, due_at, question_bank (id, question, ideal_points, tags, round_type)"
    )
    .eq("user_id", user.id)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(30);

  const cards = (due ?? [])
    .map((row) => {
      const qb = Array.isArray(row.question_bank)
        ? row.question_bank[0]
        : row.question_bank;
      return qb ? { ...qb, stats: { ease: row.ease, interval_days: row.interval_days, lapses: row.lapses } } : null;
    })
    .filter(Boolean);

  const { count: total } = await supabase
    .from("user_question_stats")
    .select("question_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({ cards, dueCount: cards.length, totalCards: total ?? 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionId =
    typeof body?.questionId === "string" ? body.questionId : null;
  if (!questionId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (body?.action === "enroll") {
    const { error } = await supabase.from("user_question_stats").upsert(
      {
        user_id: user.id,
        question_id: questionId,
        due_at: new Date().toISOString(),
        ease: 2.5,
        interval_days: 0,
        lapses: 0,
      },
      { onConflict: "user_id,question_id", ignoreDuplicates: true }
    );
    if (error) {
      return NextResponse.json({ error: "db" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // action: 'review'
  const quality = Number(body?.quality);
  if (!Number.isFinite(quality) || quality < 0 || quality > 5) {
    return NextResponse.json({ error: "invalid quality" }, { status: 400 });
  }

  const { data: prior } = await supabase
    .from("user_question_stats")
    .select("ease, interval_days, lapses")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!prior) {
    return NextResponse.json({ error: "not enrolled" }, { status: 404 });
  }

  const update = reviewCard(
    { ease: prior.ease, interval_days: prior.interval_days, lapses: prior.lapses },
    quality
  );
  const { error } = await supabase
    .from("user_question_stats")
    .update(update)
    .eq("user_id", user.id)
    .eq("question_id", questionId);
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const streak = await touchStreak(supabase, user.id);
  return NextResponse.json({
    ok: true,
    nextInDays: update.interval_days,
    streak,
  });
}
