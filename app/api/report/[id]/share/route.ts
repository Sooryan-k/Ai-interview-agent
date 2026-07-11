import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";

/**
 * Toggle public sharing for a report. Zero AI cost.
 * POST   → ensure a share_slug exists, return it
 * DELETE → remove the slug (link stops working immediately)
 * RLS "own reports" limits both to the report's owner.
 */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: report } = await supabase
    .from("reports")
    .select("share_slug")
    .eq("interview_id", interviewId)
    .maybeSingle();
  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (report.share_slug) {
    return NextResponse.json({ slug: report.share_slug });
  }

  const slug = nanoid(12); // unguessable
  const { error } = await supabase
    .from("reports")
    .update({ share_slug: slug })
    .eq("interview_id", interviewId);
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ slug });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("reports")
    .update({ share_slug: null })
    .eq("interview_id", interviewId);
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
