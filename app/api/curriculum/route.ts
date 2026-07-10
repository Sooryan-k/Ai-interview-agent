import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
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

/** Rough size of a finished curriculum JSON — used to map bytes → % progress. */
const TARGET_CHARS = 7000;

type Supa = Awaited<ReturnType<typeof createClient>>;

async function enroll(
  supabase: Supa,
  userId: string,
  curriculumId: string,
  experience: string,
  targetRole: string | null
) {
  await supabase.from("user_track_progress").upsert(
    {
      user_id: userId,
      curriculum_id: curriculumId,
      current_level: EXPERIENCE_TO_LEVEL[experience] ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,curriculum_id", ignoreDuplicates: true }
  );
  if (targetRole) {
    await supabase
      .from("profiles")
      .update({ target_role: targetRole })
      .eq("id", userId);
  }
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

  // 1. Global cache hit → instant, no streaming needed.
  const { data: cached } = await admin
    .from("curricula")
    .select("id")
    .eq("stack_key", stackKey)
    .maybeSingle();
  if (cached) {
    await enroll(supabase, user.id, cached.id, experience, targetRole);
    return NextResponse.json({ curriculumId: cached.id, cached: true });
  }

  // 2. Cache miss → quota gate before we open the stream.
  const blocked = await consumeQuota(supabase, [globalCheck()]);
  if (blocked) {
    return NextResponse.json(
      {
        error: "quota",
        message:
          "The app's free daily AI budget is spent. Try again tomorrow — cached study paths remain available.",
      },
      { status: 429 }
    );
  }

  // 3. Stream generation progress as newline-delimited JSON events.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        send({ stage: "Designing your curriculum", pct: 8 });

        let full = "";
        let lastPct = 8;
        for await (const chunk of streamText({
          tier: "smart",
          prompt: curriculumPrompt(stack),
          json: true,
          mockKind: "curriculum",
        })) {
          full += chunk;
          // Map accumulated length → 8..88%.
          const pct = Math.min(88, 8 + Math.floor((full.length / TARGET_CHARS) * 80));
          if (pct > lastPct) {
            lastPct = pct;
            send({ stage: "Writing your roadmap", pct });
          }
        }

        send({ stage: "Structuring levels & topics", pct: 92 });
        const structure = CurriculumSchema.parse(parseJsonLoose(full));

        const { data: inserted, error: insertError } = await admin
          .from("curricula")
          .insert({
            stack_key: stackKey,
            stack_label: structure.stack_label || stack,
            structure,
          })
          .select("id")
          .single();

        let curriculumId: string;
        if (insertError) {
          // Unique-violation race: reuse whoever won.
          const { data: existing } = await admin
            .from("curricula")
            .select("id")
            .eq("stack_key", stackKey)
            .maybeSingle();
          if (!existing) throw insertError;
          curriculumId = existing.id;
        } else {
          curriculumId = inserted.id;
        }

        send({ stage: "Saving your path", pct: 97 });
        await enroll(supabase, user.id, curriculumId, experience, targetRole);

        send({ stage: "Ready", pct: 100, curriculumId });
      } catch (err) {
        if (err instanceof RateLimitError) {
          send({
            error: "rate_limit",
            message: "AI is busy right now — try again in a minute.",
          });
        } else {
          console.error("curriculum generation failed", err);
          send({
            error: "generation_failed",
            message:
              "Couldn't finish building your path (the AI service was momentarily unavailable). Please try again.",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
