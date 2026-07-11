/**
 * Wave 1 logic verification (pure functions + mock fixtures). Zero network.
 * Run: npx tsx scripts/verify-wave1.ts
 */
process.env.GEMINI_MOCK = "1";

import { nextStreak } from "@/lib/streak";
import {
  aggregateSkills,
  aggregateDelivery,
  buildHeatmap,
  type EvalTurnRow,
} from "@/lib/analytics";
import { QuizSchema, BankSeedSchema } from "@/lib/schemas";
import { generateText, parseJsonLoose } from "@/lib/gemini";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

async function main() {
  // ---- streak transitions ----
  check(
    "streak: same day is a no-op",
    nextStreak("2026-07-11", 4, "2026-07-11") === null
  );
  check(
    "streak: consecutive day increments",
    nextStreak("2026-07-10", 4, "2026-07-11")?.streak_count === 5
  );
  check(
    "streak: gap resets to 1",
    nextStreak("2026-07-08", 9, "2026-07-11")?.streak_count === 1
  );
  check(
    "streak: first activity starts at 1",
    nextStreak(null, 0, "2026-07-11")?.streak_count === 1
  );
  check(
    "streak: month boundary works",
    nextStreak("2026-06-30", 2, "2026-07-01")?.streak_count === 3
  );

  // ---- analytics ----
  const mkRow = (
    iv: string,
    score: number,
    tags: string[],
    metrics?: { wpm?: number; fillers?: number; long_pauses?: number }
  ): EvalTurnRow => ({
    interview_id: iv,
    eval: { score, tags },
    speech_metrics: metrics ?? null,
    created_at: new Date().toISOString(),
  });
  const rows = [
    mkRow("a", 8, ["react"], { wpm: 150, fillers: 8, long_pauses: 2 }),
    mkRow("a", 4, ["css"], { wpm: 140, fillers: 6, long_pauses: 1 }),
    mkRow("b", 6, ["react"], { wpm: 155, fillers: 4, long_pauses: 1 }),
    mkRow("b", 9, ["testing"], { wpm: 160, fillers: 2, long_pauses: 0 }),
    mkRow("b", 2, ["css"]),
  ];
  const interviews = [
    { id: "a", started_at: "2026-07-01T10:00:00Z", role_track: "React" },
    { id: "b", started_at: "2026-07-08T10:00:00Z", role_track: "React" },
  ];

  const skills = aggregateSkills(rows);
  const css = skills.find((s) => s.skill === "css");
  check("skills: css averages (4+2)/2*10 = 30", css?.score === 30, String(css?.score));
  const react = skills.find((s) => s.skill === "react");
  check("skills: react averages 70", react?.score === 70, String(react?.score));

  const heat = buildHeatmap(rows, interviews);
  check("heatmap: weakest skill first", heat.rows[0]?.skill === "css", heat.rows[0]?.skill);
  check(
    "heatmap: css untouched-in-a? no — cell a=4, b=2",
    heat.rows[0]?.cells[0] === 4 && heat.rows[0]?.cells[1] === 2,
    JSON.stringify(heat.rows[0]?.cells)
  );

  const delivery = aggregateDelivery(rows, interviews);
  check("delivery: 2 points", delivery.points.length === 2);
  check(
    "delivery: fillers 14 then 6",
    delivery.points[0]?.fillers === 14 && delivery.points[1]?.fillers === 6,
    JSON.stringify(delivery.points.map((p) => p.fillers))
  );
  check(
    "delivery: improvement insight fires",
    (delivery.insight ?? "").includes("down"),
    delivery.insight ?? "(none)"
  );

  // ---- mock fixtures validate against schemas ----
  const quiz = QuizSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "smart", prompt: "", json: true, mockKind: "quiz" }))
  );
  check("quiz mock matches schema", quiz.success);
  if (quiz.success) {
    check(
      "quiz mock: all mcq answers in range",
      quiz.data.questions.every(
        (q) => q.type !== "mcq" || (q.answer >= 0 && q.answer < q.options.length)
      )
    );
  }
  const bank = BankSeedSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "turn", prompt: "", json: true, mockKind: "bank" }))
  );
  check("bank mock matches schema", bank.success);

  console.log(failures === 0 ? "\nALL WAVE-1 CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
