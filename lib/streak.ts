import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Daily streak tracking on profiles.streak_count / last_active_date.
 * Call `touchStreak` from any "meaningful activity" write path (study progress,
 * interview turns, daily drill). Idempotent within a day.
 */

/** UTC calendar date string (YYYY-MM-DD). */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Pure transition: given the stored state and today, compute the next state. */
export function nextStreak(
  lastActive: string | null,
  streak: number,
  today: string
): { streak_count: number; last_active_date: string } | null {
  if (lastActive === today) return null; // already counted today
  const yesterday = utcDay(new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000));
  const streak_count = lastActive === yesterday ? Math.max(1, streak) + 1 : 1;
  return { streak_count, last_active_date: today };
}

/** Records activity for today. Returns the current streak count. */
export async function touchStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("streak_count, last_active_date")
    .eq("id", userId)
    .maybeSingle();

  const current = profile?.streak_count ?? 0;
  const update = nextStreak(profile?.last_active_date ?? null, current, utcDay());
  if (!update) return current;

  await supabase.from("profiles").update(update).eq("id", userId);
  return update.streak_count;
}
