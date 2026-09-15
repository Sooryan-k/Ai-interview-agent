import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { reviewCard } from "@/lib/sm2";
import { stackName } from "@/lib/stacks";
import {
  drillProgress,
  isValidTimeZone,
  localDay,
  reconcileDrillSet,
  type DrillRow,
} from "@/lib/drill";
import {
  findDuplicate,
  questionSignature,
  type HistoryEntry,
} from "@/lib/question-history";

/**
 * Daily Drill — one question per selected technology, per day. Zero Gemini
 * calls; questions come from the shared question_bank.
 *
 * GET  ?tz=Area/City → today's stored set, generating it on first visit.
 * POST { drillId, result } → grades one question and records it.
 *
 * The set is STORED, not recomputed. The previous version hashed the day and
 * the user id against a live count of the bank, which changed whenever anyone
 * seeded it, and kept answer state only in React — so a refresh produced a
 * different question with its answer forgotten.
 */

interface BankRow {
  id: string;
  question: string;
  ideal_points: string[] | null;
  tags: string[] | null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tzParam = new URL(request.url).searchParams.get("tz");
  const timeZone = isValidTimeZone(tzParam) ? tzParam : null;
  const day = localDay(timeZone);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stack_ids")
    .eq("id", user.id)
    .maybeSingle();
  const stackIds: string[] = profile?.stack_ids ?? [];

  if (stackIds.length === 0) {
    return NextResponse.json({
      day,
      questions: [],
      progress: drillProgress([]),
      needsStacks: true,
    });
  }

  // What already exists for today.
  const { data: existingRows } = await supabase
    .from("daily_drills")
    .select(
      "id, stack_id, position, question, ideal_points, tags, answered_at, result"
    )
    .eq("user_id", user.id)
    .eq("drill_date", day)
    .order("position", { ascending: true });

  const existing = (existingRows ?? []) as (DrillRow & {
    id: string;
    question: string;
    ideal_points: string[];
    tags: string[];
  })[];

  const plan = reconcileDrillSet(existing, stackIds);

  // Drop unanswered questions for technologies the user has since removed.
  if (plan.toRemove.length > 0) {
    await supabase
      .from("daily_drills")
      .delete()
      .eq("user_id", user.id)
      .eq("drill_date", day)
      .in("stack_id", plan.toRemove)
      .is("answered_at", null);
  }

  // Generate for technologies that don't have today's question yet. On the
  // first visit of the day that's all of them; later it's only newly added
  // ones, so the rest of the set is untouched.
  const emptyBank: string[] = [];
  if (plan.toAdd.length > 0) {
    const history = await loadHistory(supabase, user.id, plan.toAdd);
    let position = plan.nextPosition;

    for (const stackId of plan.toAdd) {
      const picked = await pickQuestion(supabase, user.id, stackId, history);
      if (!picked) {
        emptyBank.push(stackId);
        continue;
      }
      const { error } = await supabase.from("daily_drills").insert({
        user_id: user.id,
        drill_date: day,
        stack_id: stackId,
        position: position++,
        question_id: picked.id,
        question: picked.question,
        ideal_points: picked.ideal_points ?? [],
        tags: picked.tags ?? [],
      });
      // A unique violation means a concurrent request (two tabs opening at
      // once) already created this row — that's the desired outcome, not an
      // error, so let the re-read below pick up whichever won.
      if (error && error.code !== "23505") {
        console.error("drill insert failed", error);
      }
    }
  }

  // Always re-read, so the response is the stored set rather than a
  // reconstruction of what we think we just wrote.
  const { data: finalRows } = await supabase
    .from("daily_drills")
    .select(
      "id, stack_id, position, question, ideal_points, tags, answered_at, result"
    )
    .eq("user_id", user.id)
    .eq("drill_date", day)
    .order("position", { ascending: true });

  const rows = finalRows ?? [];

  return NextResponse.json({
    day,
    questions: rows.map((r) => ({
      id: r.id,
      stackId: r.stack_id,
      stackName: stackName(r.stack_id) ?? r.stack_id,
      question: r.question,
      // The ideal answer is withheld until they've answered, so the card
      // can't be "revealed" by reading the network response.
      idealPoints: r.answered_at ? (r.ideal_points ?? []) : null,
      tags: r.tags ?? [],
      answeredAt: r.answered_at,
      result: r.result,
    })),
    progress: drillProgress(rows as DrillRow[]),
    emptyBank: emptyBank.map((id) => ({
      stackId: id,
      stackName: stackName(id) ?? id,
    })),
  });
}

/** Everything this user has already been asked on these stacks. */
async function loadHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stackIds: string[]
): Promise<Map<string, HistoryEntry[]>> {
  const { data } = await supabase
    .from("question_history")
    .select("question, signature, stack_id")
    .eq("user_id", userId)
    .in("stack_id", stackIds)
    .limit(1000);

  const byStack = new Map<string, HistoryEntry[]>();
  for (const row of data ?? []) {
    const list = byStack.get(row.stack_id) ?? [];
    list.push(row);
    byStack.set(row.stack_id, list);
  }
  return byStack;
}

/**
 * Picks an unasked bank question for one technology.
 *
 * Filtered by `role_track` so a React user isn't drilled on Rust, and checked
 * against the same question_history the interview flow uses — including
 * rewordings — so the drill never repeats what an interview already covered.
 */
async function pickQuestion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  stackId: string,
  history: Map<string, HistoryEntry[]>
): Promise<BankRow | null> {
  const label = stackName(stackId) ?? stackId;
  const { data: candidates } = await supabase
    .from("question_bank")
    .select("id, question, ideal_points, tags")
    .eq("role_track", label)
    .limit(200);

  if (!candidates || candidates.length === 0) return null;

  const asked = history.get(stackId) ?? [];
  const context = [label, stackId];

  // Prefer something genuinely new; fall back to the least-recently-asked
  // rather than showing nothing at all.
  const fresh = candidates.filter(
    (c) => !findDuplicate(c.question, asked, { context })
  );
  const pool = fresh.length > 0 ? fresh : candidates;

  // Rotate by day so two users on the same stack don't get the same question
  // in lockstep, but the choice is made ONCE and then stored.
  const choice = pool[Math.floor(Math.random() * pool.length)];
  if (!choice) return null;

  // Record it immediately: the question has been put to the user the moment
  // it lands in their set, whether or not they answer it.
  await supabase.from("question_history").upsert(
    {
      user_id: userId,
      stack_id: stackId,
      topic: (choice.tags ?? [])[0] ?? "",
      difficulty: "medium",
      question: choice.question.slice(0, 1000),
      signature: questionSignature(choice.question),
    },
    { onConflict: "user_id,stack_id,signature", ignoreDuplicates: true }
  );

  return choice as BankRow;
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
  const drillId = typeof body?.drillId === "string" ? body.drillId : null;
  const result = body?.result === "got_it" ? "got_it" : "missed";
  if (!drillId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("daily_drills")
    .select("id, drill_date, question_id, answered_at, ideal_points")
    .eq("id", drillId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Answering is once per question per day. A second grade — a double click,
  // or a stale tab — returns the stored one instead of overwriting it.
  if (row.answered_at) {
    const { data: all } = await supabase
      .from("daily_drills")
      .select("stack_id, position, answered_at, result")
      .eq("user_id", user.id)
      .eq("drill_date", row.drill_date);
    return NextResponse.json({
      ok: true,
      alreadyAnswered: true,
      idealPoints: row.ideal_points ?? [],
      progress: drillProgress((all ?? []) as DrillRow[]),
    });
  }

  const { error: updateError } = await supabase
    .from("daily_drills")
    .update({ answered_at: new Date().toISOString(), result })
    .eq("id", drillId)
    .eq("user_id", user.id)
    .is("answered_at", null);
  if (updateError) {
    console.error("drill grade failed", updateError);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  // Keep the spaced-repetition schedule in step, so a drilled question also
  // comes back in Practice at the right time.
  if (row.question_id) {
    const { data: existing } = await supabase
      .from("user_question_stats")
      .select("ease, interval_days, lapses")
      .eq("user_id", user.id)
      .eq("question_id", row.question_id)
      .maybeSingle();
    const update = reviewCard(
      {
        ease: existing?.ease ?? 2.5,
        interval_days: existing?.interval_days ?? 0,
        lapses: existing?.lapses ?? 0,
      },
      result === "got_it" ? 4 : 2
    );
    await supabase
      .from("user_question_stats")
      .upsert(
        { user_id: user.id, question_id: row.question_id, ...update },
        { onConflict: "user_id,question_id" }
      );
  }

  const streak = await touchStreak(supabase, user.id);

  const { data: all } = await supabase
    .from("daily_drills")
    .select("stack_id, position, answered_at, result")
    .eq("user_id", user.id)
    .eq("drill_date", row.drill_date);

  return NextResponse.json({
    ok: true,
    streak,
    idealPoints: row.ideal_points ?? [],
    progress: drillProgress((all ?? []) as DrillRow[]),
  });
}
