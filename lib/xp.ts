/**
 * XP + badges, DERIVED on read from data the app already stores — no new table,
 * no write path. Zero AI cost.
 */

export interface XpInputs {
  interviewsCompleted: number;
  avgScore: number | null;
  topicsMastered: number;
  quizzesPassed: number;
  cardsReviewed: number; // spaced-repetition reviews done
  streak: number;
  storiesPolished: number;
}

export interface XpResult {
  xp: number;
  level: number;
  levelTitle: string;
  intoLevel: number; // xp earned within the current level
  levelSpan: number; // xp needed to clear the current level
  badges: { key: string; label: string; icon: string; earned: boolean; hint: string }[];
}

const LEVEL_TITLES = [
  "Rookie",
  "Apprentice",
  "Practitioner",
  "Interviewer's Match",
  "Sharp",
  "Standout",
  "Offer-Ready",
  "Bar Raiser",
];

/** XP thresholds grow ~1.4x per level. */
function levelForXp(xp: number): { level: number; intoLevel: number; span: number } {
  let level = 1;
  let span = 100;
  let floor = 0;
  while (xp >= floor + span && level < 99) {
    floor += span;
    level += 1;
    span = Math.round(span * 1.4);
  }
  return { level, intoLevel: xp - floor, span };
}

export function computeXp(i: XpInputs): XpResult {
  const xp =
    i.interviewsCompleted * 100 +
    i.topicsMastered * 25 +
    i.quizzesPassed * 40 +
    i.cardsReviewed * 5 +
    i.storiesPolished * 30 +
    Math.round((i.avgScore ?? 0) * 2) +
    Math.min(i.streak, 30) * 10;

  const { level, intoLevel, span } = levelForXp(xp);

  const badges = [
    {
      key: "first_interview",
      label: "First Round",
      icon: "🎬",
      earned: i.interviewsCompleted >= 1,
      hint: "Complete your first mock interview",
    },
    {
      key: "streak_7",
      label: "Week Warrior",
      icon: "🔥",
      earned: i.streak >= 7,
      hint: "Keep a 7-day streak",
    },
    {
      key: "high_scorer",
      label: "High Scorer",
      icon: "🎯",
      earned: (i.avgScore ?? 0) >= 80,
      hint: "Average 80+ across interviews",
    },
    {
      key: "quiz_master",
      label: "Quiz Master",
      icon: "🧠",
      earned: i.quizzesPassed >= 5,
      hint: "Pass 5 module quizzes",
    },
    {
      key: "storyteller",
      label: "Storyteller",
      icon: "📖",
      earned: i.storiesPolished >= 3,
      hint: "Polish 3 STAR stories",
    },
    {
      key: "grinder",
      label: "The Grinder",
      icon: "💪",
      earned: i.cardsReviewed >= 50,
      hint: "Review 50 practice cards",
    },
    {
      key: "scholar",
      label: "Scholar",
      icon: "🎓",
      earned: i.topicsMastered >= 20,
      hint: "Master 20 topics",
    },
    {
      key: "veteran",
      label: "Veteran",
      icon: "🏆",
      earned: i.interviewsCompleted >= 10,
      hint: "Complete 10 interviews",
    },
  ];

  return {
    xp,
    level,
    levelTitle: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    intoLevel,
    levelSpan: span,
    badges,
  };
}
