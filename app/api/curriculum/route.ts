import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck } from "@/lib/quota";
import { curriculumPrompt } from "@/lib/prompts/curriculum";
import { CurriculumSchema } from "@/lib/schemas";
import { slugify } from "@/lib/utils";

export const maxDuration = 60;

const EXPERIENCE_TO_LEVEL: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  experienced: 2,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const stack = typeof body?.stack === "string" ? body.stack.trim() : "";
  const experience =
    typeof body?.experience === "string" ? body.experience : "beginner";
  const targetRole =
    typeof body?.targetRole === "string" ? body.targetRole.trim() : null;

  if (!stack || stack.length < 2 || stack.length > 80) {
    return NextResponse.json({ error: "invalid stack" }, { status: 400 });
  }

  const stackKey = slugify(stack);
  const admin = createAdminClient();

  // 1. Global cache lookup — a curriculum is shared by every user of the stack.
  let { data: curriculum } = await admin
    .from("curricula")
    .select("id, stack_label")
    .eq("stack_key", stackKey)
    .maybeSingle();

  // 2. Cache miss: generate once with the smart model.
  if (!curriculum) {
    const blockedScope = await consumeQuota(supabase, [globalCheck()]);
    if (blockedScope) {
      return NextResponse.json(
        {
          error: "quota",
          message:
            "The app's free daily AI budget is spent. Try again tomorrow — cached study paths remain available.",
        },
        { status: 429 }
      );
    }

    let structure;
    try {
      const raw = await generateText({
        tier: "smart",
        prompt: curriculumPrompt(stack),
        json: true,
        mockKind: "curriculum",
      });
      structure = CurriculumSchema.parse(parseJsonLoose(raw));
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json(
          { error: "rate_limit", retryAfter: err.retryAfterSeconds },
          { status: 429 }
        );
      }
      console.error("curriculum generation failed", err);
      return NextResponse.json(
        { error: "generation_failed" },
        { status: 502 }
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from("curricula")
      .insert({
        stack_key: stackKey,
        stack_label: structure.stack_label || stack,
        structure,
      })
      .select("id, stack_label")
      .single();

    if (insertError) {
      // Unique-violation race: another request generated it first — reuse theirs.
      const { data: existing } = await admin
        .from("curricula")
        .select("id, stack_label")
        .eq("stack_key", stackKey)
        .maybeSingle();
      if (!existing) {
        console.error("curriculum insert failed", insertError);
        return NextResponse.json({ error: "db" }, { status: 500 });
      }
      curriculum = existing;
    } else {
      curriculum = inserted;
    }
  }

  // 3. Enroll the user (idempotent) and store their target role.
  const startLevel = EXPERIENCE_TO_LEVEL[experience] ?? 0;
  const { error: progressError } = await supabase
    .from("user_track_progress")
    .upsert(
      {
        user_id: user.id,
        curriculum_id: curriculum.id,
        current_level: startLevel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,curriculum_id", ignoreDuplicates: true }
    );
  if (progressError) {
    console.error("progress upsert failed", progressError);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  if (targetRole) {
    await supabase
      .from("profiles")
      .update({ target_role: targetRole })
      .eq("id", user.id);
  }

  return NextResponse.json({ curriculumId: curriculum.id });
}
