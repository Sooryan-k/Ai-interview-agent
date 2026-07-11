/**
 * Wave 2 logic verification (pure functions + mock fixtures). Zero network.
 * Run: npx tsx scripts/verify-wave2.ts
 */
process.env.GEMINI_MOCK = "1";

import { reviewCard } from "@/lib/sm2";
import { computeXp } from "@/lib/xp";
import { buildStudyIcs } from "@/lib/ics";
import {
  ResumeStructSchema,
  RoastSchema,
} from "@/lib/schemas";
import { generateText, parseJsonLoose } from "@/lib/gemini";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

async function main() {
  // ---- SM-2 ----
  const now = new Date("2026-07-11T12:00:00Z");
  const r1 = reviewCard({ ease: 2.5, interval_days: 0, lapses: 0 }, 5, now);
  const r2 = reviewCard(r1, 5, now);
  const r3 = reviewCard(r2, 5, now);
  check("sm2: 1 -> 6 -> ×ease intervals", r1.interval_days === 1 && r2.interval_days === 6 && r3.interval_days > 6);
  const rf = reviewCard(r3, 1, now);
  check("sm2: fail resets to 1 + lapse", rf.interval_days === 1 && rf.lapses === 1);
  check("sm2: ease never below 1.3", reviewCard({ ease: 1.3, interval_days: 5, lapses: 0 }, 0, now).ease >= 1.3);
  check("sm2: due_at in the future on pass", Date.parse(r1.due_at) > now.getTime());

  // ---- XP + badges ----
  const zero = computeXp({
    interviewsCompleted: 0, avgScore: null, topicsMastered: 0,
    quizzesPassed: 0, cardsReviewed: 0, streak: 0, storiesPolished: 0,
  });
  check("xp: fresh user is level 1, 0 xp", zero.level === 1 && zero.xp === 0);
  check("xp: no badges earned at zero", zero.badges.every((b) => !b.earned));

  const active = computeXp({
    interviewsCompleted: 10, avgScore: 82, topicsMastered: 20,
    quizzesPassed: 5, cardsReviewed: 50, streak: 7, storiesPolished: 3,
  });
  check("xp: active user levels up past 1", active.level > 1, `level ${active.level}`);
  check("xp: veteran badge earned at 10 interviews", active.badges.find((b) => b.key === "veteran")?.earned === true);
  check("xp: all 8 milestone badges earned by power user", active.badges.filter((b) => b.earned).length === 8);
  check("xp: intoLevel within span", active.intoLevel >= 0 && active.intoLevel < active.levelSpan);

  // ---- ICS ----
  const ics = buildStudyIcs([
    { title: "Prep: Closures", description: "• Closures — scope", date: new Date("2026-07-12"), minutes: 45 },
  ]);
  check("ics: has calendar wrapper", ics.includes("BEGIN:VCALENDAR") && ics.includes("END:VCALENDAR"));
  check("ics: has an event with alarm", ics.includes("BEGIN:VEVENT") && ics.includes("BEGIN:VALARM"));
  check("ics: escapes commas in summary", buildStudyIcs([
    { title: "A, B", description: "x", date: new Date(), minutes: 30 },
  ]).includes("SUMMARY:A\\, B"));

  // ---- mock fixtures ----
  const resume = ResumeStructSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "smart", prompt: "", json: true, mockKind: "resume" }))
  );
  check("resume mock matches schema", resume.success);
  const roast = RoastSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "turn", prompt: "", json: true, mockKind: "roast" }))
  );
  check("roast mock matches schema", roast.success);

  console.log(failures === 0 ? "\nALL WAVE-2 CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
