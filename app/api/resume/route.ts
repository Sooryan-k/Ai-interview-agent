import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateText, parseJsonLoose, RateLimitError } from "@/lib/gemini";
import { consumeQuota, globalCheck, userStudyCheck } from "@/lib/quota";
import { resumePrompt } from "@/lib/prompts/resume";
import { ResumeStructSchema } from "@/lib/schemas";

export const maxDuration = 60;

/**
 * Accepts resume TEXT (extracted client-side via pdfjs — no file leaves the
 * browser as a binary) and structures it with one smart call. The result feeds
 * the interviewer prompt ("candidate claims X — probe it") for free thereafter.
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
  const resumeText =
    typeof body?.text === "string" ? body.text.trim().slice(0, 12000) : "";
  if (resumeText.length < 100) {
    return NextResponse.json(
      { error: "too_short", message: "That didn't look like a resume — try another file or paste the text." },
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

  let struct;
  try {
    const raw = await generateText({
      tier: "smart",
      prompt: resumePrompt(resumeText),
      json: true,
      mockKind: "resume",
    });
    struct = ResumeStructSchema.parse(parseJsonLoose(raw));
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limit", retryAfter: err.retryAfterSeconds },
        { status: 429 }
      );
    }
    console.error("resume structuring failed", err);
    return NextResponse.json({ error: "generation_failed" }, { status: 502 });
  }

  // Merge extracted skills into the rolling skill profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("skills")
    .eq("id", user.id)
    .maybeSingle();
  const skills = (profile?.skills ?? {}) as Record<string, unknown>;
  for (const s of struct.skills) {
    const key = s.toLowerCase();
    if (!skills[key]) skills[key] = { level: "claimed", source: "resume" };
  }

  await supabase
    .from("profiles")
    .update({
      resume_text: resumeText,
      resume_struct: struct,
      skills,
    })
    .eq("id", user.id);

  return NextResponse.json({ struct });
}
