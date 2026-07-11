import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck, userStudyCheck } from "@/lib/quota";
import { storyPolishPrompt } from "@/lib/prompts/story";

export const maxDuration = 60;

const PolishSchema = z.object({
  polished_md: z.string(),
  tags: z.array(z.string()).catch([]),
});

/** Polish one story into STAR format. 1 Gemini call, cached on the row. */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: story } = await supabase
    .from("stories")
    .select("title, raw_md")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!story) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!story.raw_md || story.raw_md.trim().length < 20) {
    return NextResponse.json(
      { error: "too_short", message: "Write a few sentences first, then polish." },
      { status: 400 }
    );
  }

  const blocked = await consumeQuota(supabase, [
    globalCheck(),
    userStudyCheck(user.id),
  ]);
  if (blocked) {
    return NextResponse.json(
      { error: "quota", message: "Daily AI budget reached — try again tomorrow." },
      { status: 429 }
    );
  }

  let result;
  try {
    const raw = await generateText({
      tier: "smart",
      prompt: storyPolishPrompt({ title: story.title, raw: story.raw_md }),
      json: true,
      mockKind: "polish",
    });
    result = PolishSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("story polish failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  const { data: updated } = await supabase
    .from("stories")
    .update({
      polished_md: result.polished_md,
      tags: result.tags.slice(0, 3).map((t) => t.toLowerCase()),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, raw_md, polished_md, tags, updated_at")
    .maybeSingle();

  return NextResponse.json({ story: updated });
}
