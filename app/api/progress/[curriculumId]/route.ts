import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Removes a prep path from the user's dashboard. Only deletes their own
 * enrollment/progress row — curricula are a global cache shared by every
 * user, so the curriculum itself (and everyone else's progress on it)
 * is untouched.
 */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ curriculumId: string }> }
) {
  const { curriculumId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("user_track_progress")
    .delete()
    .eq("curriculum_id", curriculumId)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "db" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
