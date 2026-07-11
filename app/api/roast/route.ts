import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck } from "@/lib/quota";
import { roastPrompt } from "@/lib/prompts/resume";
import { RoastSchema } from "@/lib/schemas";

export const maxDuration = 60;

/**
 * "Roast my resume" — one flash-lite call on the stored resume text.
 * Uses the interview daily cap so it can't be spammed; result is returned
 * to the client (not persisted — it's a fun, ephemeral output).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  // Prefer the just-extracted text; fall back to the stored resume.
  let resumeText =
    typeof body?.text === "string" ? body.text.trim().slice(0, 12000) : "";
  if (resumeText.length < 100) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("resume_text")
      .eq("id", user.id)
      .maybeSingle();
    resumeText = (profile?.resume_text ?? "").slice(0, 12000);
  }
  if (resumeText.length < 100) {
    return NextResponse.json(
      { error: "no_resume", message: "Upload your resume first, then roast it." },
      { status: 400 }
    );
  }

  const blocked = await consumeQuota(supabase, [globalCheck()]);
  if (blocked) {
    return NextResponse.json(
      { error: "quota", message: "Daily AI budget reached — try again tomorrow." },
      { status: 429 }
    );
  }

  let roast;
  try {
    const raw = await generateText({
      tier: "turn",
      prompt: roastPrompt(resumeText),
      json: true,
      mockKind: "roast",
    });
    roast = RoastSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("roast failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  return NextResponse.json({ roast });
}
