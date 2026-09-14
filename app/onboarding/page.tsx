import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";
import { resolveStackId } from "@/lib/stacks";

/**
 * Setup, and also "add another technology" — the prep page links back here.
 *
 * The form is prefilled from the profile because saving is a full overwrite:
 * arriving with a blank picker and choosing one technology would silently
 * reduce a ten-stack profile to one.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: enrollments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role_id, role_other, stack_ids, primary_stack_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_track_progress")
      .select("curricula (stack_label)")
      .eq("user_id", user.id),
  ]);

  // Which technologies already have a path, so the form can say so.
  const existingStackIds = (enrollments ?? [])
    .map((e) => {
      const row = Array.isArray(e.curricula) ? e.curricula[0] : e.curricula;
      return row?.stack_label ? resolveStackId(row.stack_label) : null;
    })
    .filter((id): id is string => Boolean(id));

  return (
    <OnboardingForm
      initial={{
        roleId: profile?.role_id ?? null,
        roleOther: profile?.role_other ?? "",
        stackIds: profile?.stack_ids ?? [],
        primaryStackId: profile?.primary_stack_id ?? null,
        existingStackIds: [...new Set(existingStackIds)],
      }}
    />
  );
}
