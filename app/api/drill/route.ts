import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { touchStreak, utcDay } from "@/lib/streak";

/**
 * Daily drill — question of the day. Zero Gemini calls.
 * GET  → deterministic date-hash pick from question_bank (per user+day).
 * POST → self-grade { questionId, result: 'got_it' | 'missed' } → simple
 *        scheduling into user_question_stats (full SM-2 arrives in Wave 2).
 */

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = utcDay();

  // Due spaced-repetition cards take priority over the random daily pick.
  const { data: due } = await supabase
    .from("user_question_stats")
    .select("question_id, question_bank (id, question, ideal_points, tags)")
    .eq("user_id", user.id)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(1);
  if (due && due.length > 0) {
    const qb = Array.isArray(due[0].question_bank)
      ? due[0].question_bank[0]
      : due[0].question_bank;
    if (qb) {
      return NextResponse.json({ question: qb, kind: "review", day: today });
    }
  }

  // Deterministic date-hash pick: same question all day for this user.
  const { count } = await supabase
    .from("question_bank")
    .select("id", { count: "exact", head: true });
  if (!count) {
    return NextResponse.json({ question: null, kind: "empty", day: today });
  }
  const offset = hashStr(`${today}:${user.id}`) % count;
  const { data: rows } = await supabase
    .from("question_bank")
    .select("id, question, ideal_points, tags")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset);

  return NextResponse.json({
    question: rows?.[0] ?? null,
    kind: rows?.[0] ? "daily" : "empty",
    day: today,
  });
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
  const result = body?.result === "got_it" ? "got_it" : "missed";
  if (!questionId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_question_stats")
    .select("ease, interval_days, lapses")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();

  // Simple scheduling (Wave 2 replaces this with full SM-2):
  // got_it → interval doubles (min 3 days); missed → back to tomorrow, lapse++.
  const prevInterval = existing?.interval_days ?? 0;
  const intervalDays =
    result === "got_it" ? Math.max(3, prevInterval * 2 || 3) : 1;
  const dueAt = new Date(Date.now() + intervalDays * 86_400_000).toISOString();

  const { error } = await supabase.from("user_question_stats").upsert(
    {
      user_id: user.id,
      question_id: questionId,
      interval_days: intervalDays,
      due_at: dueAt,
      lapses: (existing?.lapses ?? 0) + (result === "missed" ? 1 : 0),
      last_result: result,
      ease: existing?.ease ?? 2.5,
    },
    { onConflict: "user_id,question_id" }
  );
  if (error) {
    console.error("drill grade failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  const streak = await touchStreak(supabase, user.id);
  return NextResponse.json({ ok: true, streak, nextInDays: intervalDays });
}
