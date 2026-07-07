import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_STATUS = new Set(["todo", "learning", "mastered"]);

/** Updates one topic's status inside the user's progress jsonb. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const curriculumId =
    typeof body?.curriculumId === "string" ? body.curriculumId : null;
  const topicKey = typeof body?.topicKey === "string" ? body.topicKey : null;
  const status = typeof body?.status === "string" ? body.status : null;
  const onlyIfTodo = body?.onlyIfTodo === true;

  if (!curriculumId || !topicKey || !status || !VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("user_track_progress")
    .select("topic_status")
    .eq("user_id", user.id)
    .eq("curriculum_id", curriculumId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "not enrolled" }, { status: 404 });
  }

  const topicStatus = (row.topic_status ?? {}) as Record<string, string>;
  if (onlyIfTodo && topicStatus[topicKey] && topicStatus[topicKey] !== "todo") {
    return NextResponse.json({ ok: true, unchanged: true });
  }
  topicStatus[topicKey] = status;

  const { error } = await supabase
    .from("user_track_progress")
    .update({
      topic_status: topicStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("curriculum_id", curriculumId);

  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
