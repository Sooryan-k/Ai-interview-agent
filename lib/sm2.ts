/**
 * SM-2 spaced repetition, adapted to the columns that already exist on
 * `user_question_stats` (ease, interval_days, lapses). Pure + unit-tested.
 *
 * quality: 0-5 self-grade (0 = blackout, 3 = correct with effort, 5 = perfect).
 * We derive the "repetition step" from interval_days instead of storing a
 * separate counter: 0 -> first success -> 1 day; 1 -> 6 days; then × ease.
 */

export interface CardStats {
  ease: number; // ease factor, min 1.3
  interval_days: number;
  lapses: number;
}

export interface CardUpdate extends CardStats {
  due_at: string; // ISO
  last_result: string;
}

export function reviewCard(
  prior: CardStats,
  quality: number,
  now: Date = new Date()
): CardUpdate {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const priorEase = prior.ease > 0 ? prior.ease : 2.5;

  // Ease update (standard SM-2 formula), floored at 1.3.
  const ease = Math.max(
    1.3,
    priorEase + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  let interval_days: number;
  let lapses = prior.lapses;

  if (q < 3) {
    // Failed recall — relearn tomorrow, count a lapse.
    interval_days = 1;
    lapses += 1;
  } else if (prior.interval_days <= 0) {
    interval_days = 1; // first successful review
  } else if (prior.interval_days === 1) {
    interval_days = 6; // second successful review
  } else {
    interval_days = Math.max(2, Math.round(prior.interval_days * ease));
  }

  // Cap to keep due dates sane on a study app.
  interval_days = Math.min(interval_days, 365);

  const due_at = new Date(
    now.getTime() + interval_days * 86_400_000
  ).toISOString();

  return {
    ease: Math.round(ease * 1000) / 1000,
    interval_days,
    lapses,
    due_at,
    last_result: q >= 3 ? "pass" : "fail",
  };
}
