import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStackId } from "@/lib/stacks";

/** Per-stack counts of how many questions this user has already been asked. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("question_history")
    .select("stack_id")
    .eq("user_id", user.id);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.stack_id] = (counts[row.stack_id] ?? 0) + 1;
  }
  return NextResponse.json({ counts });
}

/**
 * Clears the record of what this user has been asked, so previously seen
 * questions become available again.
 *
 * Scoped to one stack by default. Wiping everything needs `all=1` spelled out,
 * so a missing or misspelled stack id can never be read as "delete the lot".
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const stackId = url.searchParams.get("stackId");
  const all = url.searchParams.get("all") === "1";

  if (!all && !stackId) {
    return NextResponse.json(
      { error: "bad_request", message: "Which stack should be reset?" },
      { status: 400 }
    );
  }
  if (!all && stackId && !isStackId(stackId)) {
    return NextResponse.json(
      { error: "bad_request", message: "Unknown technology." },
      { status: 400 }
    );
  }

  let query = supabase
    .from("question_history")
    .delete({ count: "exact" })
    .eq("user_id", user.id);
  if (!all && stackId) query = query.eq("stack_id", stackId);

  const { error, count } = await query;
  if (error) {
    console.error("question history reset failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cleared: count ?? 0 });
}
