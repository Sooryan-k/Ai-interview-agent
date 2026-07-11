import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Update / delete a single story. Zero AI cost. */
export async function PUT(
  request: Request,
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
  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") patch.title = body.title.trim().slice(0, 120);
  if (typeof body?.raw === "string") patch.raw_md = body.raw.trim().slice(0, 4000);

  const { data, error } = await supabase
    .from("stories")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, raw_md, polished_md, tags, updated_at")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ story: data });
}

export async function DELETE(
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
  const { error } = await supabase
    .from("stories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
