import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_STACKS, MIN_STACKS, isStackId } from "@/lib/stacks";
import { isRoleId } from "@/lib/roles";

/**
 * Saves the user's role and tech-stack selection.
 *
 * The 1-10 rule is enforced HERE as well as in the picker — the UI limit is a
 * convenience, this is the actual guarantee. Unknown ids are rejected outright
 * rather than filtered, so a client bug surfaces instead of silently saving a
 * partial selection.
 */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  // ---- stacks ----
  const raw = body?.stackIds;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "invalid", message: "stackIds must be an array." },
      { status: 400 }
    );
  }
  // De-dupe before counting, so ["react","react"] isn't treated as two.
  const stackIds = [...new Set(raw.filter((v): v is string => typeof v === "string"))];

  if (stackIds.length < MIN_STACKS) {
    return NextResponse.json(
      { error: "too_few", message: "Pick at least one technology." },
      { status: 400 }
    );
  }
  if (stackIds.length > MAX_STACKS) {
    return NextResponse.json(
      {
        error: "too_many",
        message: `You can save up to ${MAX_STACKS} technologies — remove ${
          stackIds.length - MAX_STACKS
        } to continue.`,
      },
      { status: 400 }
    );
  }
  const unknown = stackIds.filter((id) => !isStackId(id));
  if (unknown.length > 0) {
    return NextResponse.json(
      {
        error: "unknown_stack",
        message: `Unrecognised technology: ${unknown.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  // ---- primary stack ----
  const rawPrimary = body?.primaryStackId;
  const primaryStackId =
    typeof rawPrimary === "string" && rawPrimary ? rawPrimary : null;
  if (primaryStackId && !stackIds.includes(primaryStackId)) {
    return NextResponse.json(
      {
        error: "bad_primary",
        message: "Your primary technology must be one you've selected.",
      },
      { status: 400 }
    );
  }

  // ---- role (optional) ----
  const rawRole = body?.roleId;
  const roleId = typeof rawRole === "string" && rawRole ? rawRole : null;
  if (roleId && !isRoleId(roleId)) {
    return NextResponse.json(
      { error: "unknown_role", message: "Unrecognised role." },
      { status: 400 }
    );
  }
  const rawOther = body?.roleOther;
  const roleOther =
    roleId === "other" && typeof rawOther === "string" && rawOther.trim()
      ? rawOther.trim().slice(0, 80)
      : null;
  if (roleId === "other" && !roleOther) {
    return NextResponse.json(
      { error: "role_other_required", message: "Tell us your role." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      role_id: roleId,
      role_other: roleOther,
      stack_ids: stackIds,
      primary_stack_id: primaryStackId,
      // Marks this profile as no longer needing the legacy backfill.
      stacks_migrated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("profile stacks update failed", error);
    return NextResponse.json({ error: "db" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stackIds, primaryStackId, roleId });
}
