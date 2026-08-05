import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CurriculumSchema } from "@/lib/schemas";
import { buildStudyIcs, type StudyBlock } from "@/lib/ics";

/**
 * Generates a downloadable .ics study plan: one evening study block per day
 * over the next N days, drawn from the user's not-yet-mastered topics. Zero AI.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    30,
    Math.max(3, Number(new URL(request.url).searchParams.get("days")) || 14)
  );

  const { data: enrollments } = await supabase
    .from("user_track_progress")
    .select("topic_status, curricula (stack_label, structure)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  // Collect not-yet-mastered topics across the user's paths.
  const remaining: { title: string; objective: string; stack: string; minutes: number }[] = [];
  for (const e of enrollments ?? []) {
    const cur = Array.isArray(e.curricula) ? e.curricula[0] : e.curricula;
    const parsed = CurriculumSchema.safeParse(cur?.structure);
    if (!parsed.success) continue;
    const status = (e.topic_status ?? {}) as Record<string, string>;
    for (const level of parsed.data.levels) {
      for (const mod of level.modules) {
        for (const t of mod.topics) {
          if (status[t.key] !== "mastered") {
            remaining.push({
              title: t.title,
              objective: t.objective,
              stack: cur?.stack_label ?? "Prep",
              minutes: t.est_minutes || 45,
            });
          }
        }
      }
    }
  }

  if (remaining.length === 0) {
    return NextResponse.json(
      { error: "nothing_to_plan", message: "No unfinished topics to schedule." },
      { status: 400 }
    );
  }

  // Spread topics over `days`, packing ~1 block/day.
  const blocks: StudyBlock[] = [];
  const perDay = Math.ceil(remaining.length / days);
  let idx = 0;
  for (let d = 0; d < days && idx < remaining.length; d++) {
    const chunk = remaining.slice(idx, idx + perDay);
    idx += perDay;
    if (chunk.length === 0) break;
    const date = new Date();
    date.setDate(date.getDate() + d + 1);
    blocks.push({
      title: `Prep: ${chunk.map((c) => c.title).join(", ").slice(0, 60)}`,
      description: chunk
        .map((c) => `• ${c.title} — ${c.objective}`)
        .join("\n"),
      date,
      minutes: Math.min(90, chunk.reduce((s, c) => s + c.minutes, 0)),
    });
  }

  const ics = buildStudyIcs(blocks);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dryrun-ai-study-plan.ics"',
    },
  });
}
