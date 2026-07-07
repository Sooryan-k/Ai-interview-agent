import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Atomic daily quota guard backed by the `increment_usage` Postgres function.
 * Scopes:
 *   'global'                     — every Gemini call, app-wide
 *   `user:{id}:interviews`       — interviews started per user per day
 *   `user:{id}:study`            — new study topics generated per user per day
 */

export const CAPS = {
  global: () => Number(process.env.GLOBAL_DAILY_CALL_CAP || 800),
  userInterviews: () => Number(process.env.USER_DAILY_INTERVIEW_CAP || 3),
  userStudy: () => Number(process.env.USER_DAILY_STUDY_TOPIC_CAP || 10),
};

export type QuotaCheck = { scope: string; max: number };

/**
 * Consumes one unit from each scope in order. Returns the first scope that
 * is over its cap, or null if all pass. In mock mode, quota is not consumed.
 */
export async function consumeQuota(
  supabase: SupabaseClient,
  checks: QuotaCheck[]
): Promise<string | null> {
  if (process.env.GEMINI_MOCK === "1") return null;
  for (const { scope, max } of checks) {
    const { data, error } = await supabase.rpc("increment_usage", {
      p_scope: scope,
      p_max: max,
    });
    if (error) throw new Error(`quota check failed: ${error.message}`);
    if (data === false) return scope;
  }
  return null;
}

export function globalCheck(): QuotaCheck {
  return { scope: "global", max: CAPS.global() };
}

export function userInterviewCheck(userId: string): QuotaCheck {
  return { scope: `user:${userId}:interviews`, max: CAPS.userInterviews() };
}

export function userStudyCheck(userId: string): QuotaCheck {
  return { scope: `user:${userId}:study`, max: CAPS.userStudy() };
}
