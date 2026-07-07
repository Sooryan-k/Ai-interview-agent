import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumeQuota, userInterviewCheck } from "@/lib/quota";
import { CurriculumSchema } from "@/lib/schemas";

const ROUND_TYPES = new Set([
  "behavioral",
  "technical",
  "system_design",
  "dsa",
  "hr",
]);
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const INTERVIEWER_NAMES = ["Alex", "Priya", "Marcus", "Sofia", "Ken", "Amara"];

const QUESTIONS_BY_DIFFICULTY: Record<string, number> = {
  easy: 5,
  medium: 6,
  hard: 7,
};

/** Creates an interview and returns its id. Consumes 1 interview from the user's daily cap. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const roundType = ROUND_TYPES.has(body?.roundType)
    ? (body.roundType as string)
    : "technical";
  const difficulty = DIFFICULTIES.has(body?.difficulty)
    ? (body.difficulty as string)
    : "medium";
  const curriculumId =
    typeof body?.curriculumId === "string" ? body.curriculumId : null;
  const level = Number.isInteger(body?.level) ? (body.level as number) : null;
  const jdText =
    typeof body?.jdText === "string" ? body.jdText.slice(0, 4000) : null;
  let roleTrack =
    typeof body?.roleTrack === "string" && body.roleTrack.trim()
      ? body.roleTrack.trim().slice(0, 80)
      : "";

  // If launched from a curriculum, derive the role track and validate the level.
  let curriculumLevel: number | null = null;
  if (curriculumId) {
    const { data: cur } = await supabase
      .from("curricula")
      .select("stack_label, structure")
      .eq("id", curriculumId)
      .maybeSingle();
    if (!cur) {
      return NextResponse.json({ error: "curriculum not found" }, { status: 404 });
    }
    if (!roleTrack) roleTrack = cur.stack_label;
    const parsed = CurriculumSchema.safeParse(cur.structure);
    if (parsed.success && level !== null && parsed.data.levels[level]) {
      curriculumLevel = level;
    }
  }
  if (!roleTrack) {
    return NextResponse.json({ error: "roleTrack required" }, { status: 400 });
  }

  const blocked = await consumeQuota(supabase, [userInterviewCheck(user.id)]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          "You've used today's free mock interviews. Practice Mode and your study path are still open — come back tomorrow for more rounds.",
      },
      { status: 429 }
    );
  }

  const persona = {
    interviewer_name:
      INTERVIEWER_NAMES[Math.floor(Math.random() * INTERVIEWER_NAMES.length)],
    question_count: QUESTIONS_BY_DIFFICULTY[difficulty],
  };

  const { data: interview, error } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      curriculum_id: curriculumId,
      curriculum_level: curriculumLevel,
      role_track: roleTrack,
      round_type: roundType,
      difficulty,
      persona,
      jd_text: jdText,
    })
    .select("id")
    .single();

  if (error || !interview) {
    console.error("interview insert failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ interviewId: interview.id });
}
