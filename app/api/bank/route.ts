import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck, userStudyCheck } from "@/lib/quota";
import { bankPrompt } from "@/lib/prompts/bank";
import { BankSeedSchema } from "@/lib/schemas";

export const maxDuration = 60;

const ROUND_TYPES = new Set([
  "behavioral",
  "system_design",
  "dsa",
  "hr",
  "technical",
]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

/**
 * Lazily seeds the question bank for a (role_track, round_type, difficulty)
 * combo — first-user-pays, then the rows are shared by everyone forever.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roleTrack =
    typeof body?.roleTrack === "string" ? body.roleTrack.trim().slice(0, 80) : "";
  const roundType = String(body?.roundType ?? "");
  const difficulty = String(body?.difficulty ?? "");
  if (!roleTrack || !ROUND_TYPES.has(roundType) || !DIFFICULTIES.has(difficulty)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  // Already seeded? (global cache — race-safe enough: worst case a few extras)
  const { count } = await supabase
    .from("question_bank")
    .select("id", { count: "exact", head: true })
    .eq("role_track", roleTrack)
    .eq("round_type", roundType)
    .eq("difficulty", difficulty);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, seeded: 0, cached: true });
  }

  const blocked = await consumeQuota(supabase, [
    globalCheck(),
    userStudyCheck(user.id),
  ]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message: "The free daily AI budget is spent — try again tomorrow.",
      },
      { status: 429 }
    );
  }

  let seed;
  try {
    const raw = await generateText({
      tier: "turn",
      prompt: bankPrompt({ roleTrack, roundType, difficulty }),
      json: true,
      mockKind: "bank",
    });
    seed = BankSeedSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("bank seed failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  const admin = createAdminClient();
  const rows = seed.questions.slice(0, 15).map((q) => ({
    role_track: roleTrack,
    round_type: roundType,
    difficulty,
    question: q.question.slice(0, 500),
    ideal_points: q.ideal_points.slice(0, 6),
    tags: q.tags.slice(0, 4).map((t) => t.toLowerCase()),
    source: "generated",
  }));
  const { error } = await admin.from("question_bank").insert(rows);
  if (error) {
    console.error("bank insert failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seeded: rows.length });
}
