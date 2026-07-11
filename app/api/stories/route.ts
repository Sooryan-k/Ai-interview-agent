import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** List + create STAR stories. Zero AI cost (polish is a separate route). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await supabase
    .from("stories")
    .select("id, title, raw_md, polished_md, tags, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  return NextResponse.json({ stories: data ?? [] });
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
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const raw = typeof body?.raw === "string" ? body.raw.trim().slice(0, 4000) : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("stories")
    .insert({ user_id: user.id, title, raw_md: raw })
    .select("id, title, raw_md, polished_md, tags, updated_at")
    .single();
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ story: data });
}
