/**
 * Offline verification of the Daily Drill and of multi-stack aggregation.
 *
 *  1. The day's set persists across refresh — same questions, same order,
 *     answered ones still answered.
 *  2. The day rolls over on the user's own timezone boundary.
 *  3. Question counts: one per selected stack, 1 stack = 1, 10 stacks = 10.
 *  4. Mid-day stack changes reconcile instead of regenerating.
 *  5. Dashboard insights aggregate per stack rather than merging them.
 *
 * Pure modules only — no database, no API key, no network. The drill route's
 * storage is simulated with an in-memory table that enforces the same unique
 * constraint the migration does.
 */
process.env.GEMINI_MOCK = "1";

import {
  drillProgress,
  isValidTimeZone,
  localDay,
  reconcileDrillSet,
  type DrillRow,
} from "@/lib/drill";
import {
  aggregateSkills,
  buildHeatmap,
  filterByStack,
  stacksWithData,
  type EvalTurnRow,
  type InterviewMeta,
} from "@/lib/analytics";
import { previousDay } from "@/lib/streak";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}
function section(title: string) {
  console.log(`\n— ${title} —`);
}

/* ================================================================== *
 * A fake daily_drills table with the migration's unique constraint
 * ================================================================== */
interface StoredRow extends DrillRow {
  id: string;
  question: string;
}

class DrillStore {
  rows: StoredRow[] = [];
  private seq = 0;
  /** How many times a question had to be generated — the refresh detector. */
  generations = 0;

  /** Mirrors the route: reconcile, insert only what's missing, re-read. */
  load(day: string, stackIds: string[], pickQuestion: (s: string) => string) {
    const existing = this.rows.filter((r) => r.day === day);
    const plan = reconcileDrillSet(existing, stackIds);

    for (const stackId of plan.toRemove) {
      const i = this.rows.findIndex(
        (r) => r.day === day && r.stack_id === stackId && !r.answered_at
      );
      if (i >= 0) this.rows.splice(i, 1);
    }

    let position = plan.nextPosition;
    for (const stackId of plan.toAdd) {
      // The unique (user, day, stack) constraint: never two rows for one
      // technology on one day.
      if (this.rows.some((r) => r.day === day && r.stack_id === stackId)) {
        continue;
      }
      this.generations++;
      this.rows.push({
        id: `row-${this.seq++}`,
        day,
        stack_id: stackId,
        position: position++,
        question: pickQuestion(stackId),
        answered_at: null,
        result: null,
      });
    }

    return this.rows
      .filter((r) => r.day === day)
      .sort((a, b) => a.position - b.position);
  }

  answer(id: string, result: "got_it" | "missed") {
    const row = this.rows.find((r) => r.id === id);
    if (!row || row.answered_at) return false; // once per day
    row.answered_at = new Date().toISOString();
    row.result = result;
    return true;
  }
}

// `day` isn't on DrillRow (the real table keys it as a column); widen locally.
declare module "@/lib/drill" {
  interface DrillRow {
    day?: string;
  }
}

/* ================================================================== *
 * 1 + 3. Persistence across refresh, and per-stack counts
 * ================================================================== */
function testPersistenceAndCounts() {
  section("The day's set is generated once and read back");

  const store = new DrillStore();
  const day = "2026-09-15";
  const stacks = ["react", "nodejs", "postgresql", "typescript", "docker"];
  let counter = 0;
  const pick = (s: string) => `Q${counter++} about ${s}`;

  const first = store.load(day, stacks, pick);
  check("5 stacks produce 5 questions", first.length === 5, `${first.length}`);
  check("one question per stack", new Set(first.map((r) => r.stack_id)).size === 5);
  check("5 questions were generated", store.generations === 5, `${store.generations}`);

  // Refresh, repeatedly.
  const second = store.load(day, stacks, pick);
  const third = store.load(day, stacks, pick);
  check("a refresh generates nothing new", store.generations === 5, `${store.generations}`);
  check(
    "refresh returns the identical questions",
    JSON.stringify(second.map((r) => r.question)) ===
      JSON.stringify(first.map((r) => r.question))
  );
  check(
    "refresh returns them in the same order",
    JSON.stringify(third.map((r) => r.stack_id)) ===
      JSON.stringify(first.map((r) => r.stack_id))
  );

  section("Answers survive a refresh");

  store.answer(first[0].id, "got_it");
  store.answer(first[1].id, "missed");
  const afterRefresh = store.load(day, stacks, pick);
  check(
    "answered questions are still answered after reload",
    Boolean(afterRefresh[0].answered_at) && Boolean(afterRefresh[1].answered_at)
  );
  check(
    "their results are intact",
    afterRefresh[0].result === "got_it" && afterRefresh[1].result === "missed"
  );
  check(
    "unanswered ones are still unanswered",
    afterRefresh.slice(2).every((r) => !r.answered_at)
  );
  check("still no regeneration", store.generations === 5, `${store.generations}`);

  check("answering twice is rejected", store.answer(first[0].id, "missed") === false);
  check(
    "the first answer stands",
    store.rows.find((r) => r.id === first[0].id)?.result === "got_it"
  );

  section("Progress and the completed state");

  let progress = drillProgress(afterRefresh);
  check("progress reads 2 of 5", progress.answered === 2 && progress.total === 5, JSON.stringify(progress));
  check("not complete yet", !progress.complete);
  check("score is over answered questions only", progress.scorePct === 50, `${progress.scorePct}`);

  for (const row of afterRefresh.slice(2)) store.answer(row.id, "got_it");
  progress = drillProgress(store.load(day, stacks, pick));
  check("progress reads 5 of 5", progress.answered === 5 && progress.total === 5);
  check("complete once all are answered", progress.complete);
  check("day score is 4 of 5 = 80%", progress.correct === 4 && progress.scorePct === 80, JSON.stringify(progress));
  check("no extra questions handed out when complete", store.load(day, stacks, pick).length === 5);
  check("still no regeneration all day", store.generations === 5, `${store.generations}`);

  section("Per-stack counts at the edges");

  for (const n of [1, 2, 5, 10]) {
    const s = new DrillStore();
    const ids = [
      "react","nodejs","postgresql","typescript","docker",
      "redis","python","django","kubernetes","graphql",
    ].slice(0, n);
    const rows = s.load("2026-09-15", ids, (x) => `q-${x}`);
    check(`${n} stack${n === 1 ? "" : "s"} = ${n} question${n === 1 ? "" : "s"}`, rows.length === n, `${rows.length}`);
  }

  const none = new DrillStore().load("2026-09-15", [], (x) => x);
  check("no stacks selected = no questions", none.length === 0);
}

/* ================================================================== *
 * 2. Day rollover on the user's timezone
 * ================================================================== */
function testDayRollover() {
  section("The day boundary is the user's, not the server's");

  // 18:30 UTC on the 15th is already the 16th in Kolkata (+05:30) and still
  // the 15th in New York (-04:00). The old code used UTC for everyone.
  const evening = new Date("2026-09-15T18:30:00Z");
  check("UTC says the 15th", localDay("UTC", evening) === "2026-09-15", localDay("UTC", evening));
  check("Kolkata says the 16th", localDay("Asia/Kolkata", evening) === "2026-09-16", localDay("Asia/Kolkata", evening));
  check("New York says the 15th", localDay("America/New_York", evening) === "2026-09-15", localDay("America/New_York", evening));

  // Just before and just after an IST midnight.
  const beforeIst = new Date("2026-09-15T18:29:00Z");
  const afterIst = new Date("2026-09-15T18:31:00Z");
  check(
    "IST rolls over at 18:30 UTC",
    localDay("Asia/Kolkata", beforeIst) === "2026-09-15" &&
      localDay("Asia/Kolkata", afterIst) === "2026-09-16"
  );

  check("an unknown timezone falls back to UTC", localDay("Not/AZone", evening) === "2026-09-15");
  check("a missing timezone falls back to UTC", localDay(null, evening) === "2026-09-15");
  check("valid zones are accepted", isValidTimeZone("Asia/Kolkata") && isValidTimeZone("UTC"));
  check("invalid zones are rejected", !isValidTimeZone("Nope/Nope") && !isValidTimeZone("") && !isValidTimeZone(42));

  section("A new day is a new set");

  const store = new DrillStore();
  const stacks = ["react", "nodejs"];
  let n = 0;
  const pick = () => `q${n++}`;

  const dayOne = store.load("2026-09-15", stacks, pick);
  for (const r of dayOne) store.answer(r.id, "got_it");
  check("day one is complete", drillProgress(store.load("2026-09-15", stacks, pick)).complete);

  const dayTwo = store.load("2026-09-16", stacks, pick);
  check("the next day gets a fresh set", dayTwo.length === 2 && store.generations === 4, `${store.generations}`);
  check("the new set is unanswered", dayTwo.every((r) => !r.answered_at));
  check(
    "the new set has different questions",
    dayTwo.every((r) => !dayOne.some((o) => o.question === r.question))
  );
  check(
    "yesterday's answers are untouched",
    store.rows.filter((r) => r.day === "2026-09-15").every((r) => Boolean(r.answered_at))
  );
  check("previousDay walks back correctly", previousDay("2026-09-16") === "2026-09-15");
  check("previousDay crosses a month boundary", previousDay("2026-10-01") === "2026-09-30");
}

/* ================================================================== *
 * 4. Mid-day stack changes
 * ================================================================== */
function testStackChanges() {
  section("Changing stacks mid-day reconciles, never regenerates");

  const store = new DrillStore();
  const day = "2026-09-15";
  let n = 0;
  const pick = (s: string) => `q${n++}-${s}`;

  const initial = store.load(day, ["react", "nodejs", "postgresql"], pick);
  store.answer(initial[0].id, "got_it"); // answered React
  const reactQuestion = initial[0].question;
  const nodeQuestion = initial[1].question;

  // Drop PostgreSQL (unanswered), add Docker.
  const after = store.load(day, ["react", "nodejs", "docker"], pick);

  check("the set is still 3 long", after.length === 3, `${after.length}`);
  check("the removed stack's unanswered question is gone", !after.some((r) => r.stack_id === "postgresql"));
  check("the newly added stack has a question", after.some((r) => r.stack_id === "docker"));
  check("only one new question was generated", store.generations === 4, `${store.generations}`);
  check(
    "the answered React question is unchanged",
    after.find((r) => r.stack_id === "react")?.question === reactQuestion
  );
  check(
    "the React answer survived",
    after.find((r) => r.stack_id === "react")?.result === "got_it"
  );
  check(
    "the untouched Node question is unchanged",
    after.find((r) => r.stack_id === "nodejs")?.question === nodeQuestion
  );
  check(
    "existing questions did not reshuffle",
    after[0].stack_id === "react" && after[1].stack_id === "nodejs"
  );
  check("the new question is appended last", after[2].stack_id === "docker");

  section("An ANSWERED question for a removed stack is kept");

  const s2 = new DrillStore();
  let m = 0;
  const rows = s2.load(day, ["react", "redis"], () => `x${m++}`);
  s2.answer(rows[1].id, "missed"); // answered Redis, then drop Redis
  const afterDrop = s2.load(day, ["react"], () => `x${m++}`);
  check(
    "the answered question for the dropped stack survives",
    afterDrop.some((r) => r.stack_id === "redis" && r.result === "missed"),
    JSON.stringify(afterDrop.map((r) => r.stack_id))
  );
  check(
    "so the day's progress doesn't go backwards",
    drillProgress(afterDrop).answered === 1
  );

  section("Reconcile plan directly");

  const plan = reconcileDrillSet(
    [
      { stack_id: "react", position: 0, answered_at: "2026-09-15T10:00:00Z", result: "got_it" },
      { stack_id: "nodejs", position: 1, answered_at: null },
      { stack_id: "redis", position: 2, answered_at: null },
    ],
    ["react", "nodejs", "docker"]
  );
  check("toAdd is the new stack only", JSON.stringify(plan.toAdd) === '["docker"]', JSON.stringify(plan.toAdd));
  check("toRemove is the unanswered orphan only", JSON.stringify(plan.toRemove) === '["redis"]', JSON.stringify(plan.toRemove));
  check("nextPosition follows the highest existing", plan.nextPosition === 3, `${plan.nextPosition}`);
  check("an unchanged selection is a no-op", reconcileDrillSet(
    [{ stack_id: "react", position: 0, answered_at: null }],
    ["react"]
  ).toAdd.length === 0);
}

/* ================================================================== *
 * 5. Multi-stack aggregation on the dashboard
 * ================================================================== */
function testMultiStackAggregation() {
  section("Dashboard insights aggregate per stack");

  const interviews: InterviewMeta[] = [
    { id: "iv-react", started_at: "2026-09-01T10:00:00Z", role_track: "React", stack_ids: ["react"] },
    { id: "iv-pg", started_at: "2026-09-02T10:00:00Z", role_track: "PostgreSQL", stack_ids: ["postgresql"] },
    { id: "iv-both", started_at: "2026-09-03T10:00:00Z", role_track: "React + PostgreSQL", stack_ids: ["react", "postgresql"] },
  ];

  const rows: EvalTurnRow[] = [
    // Strong on React.
    { interview_id: "iv-react", eval: { score: 9, tags: ["hooks"], verdict: "correct" }, speech_metrics: null, created_at: "2026-09-01T10:01:00Z" },
    { interview_id: "iv-react", eval: { score: 9, tags: ["state"], verdict: "correct" }, speech_metrics: null, created_at: "2026-09-01T10:02:00Z" },
    { interview_id: "iv-react", eval: { score: 8, tags: ["rendering"], verdict: "correct" }, speech_metrics: null, created_at: "2026-09-01T10:03:00Z" },
    // Weak on PostgreSQL.
    { interview_id: "iv-pg", eval: { score: 2, tags: ["indexes"], verdict: "incorrect" }, speech_metrics: null, created_at: "2026-09-02T10:01:00Z" },
    { interview_id: "iv-pg", eval: { score: 1, tags: ["transactions"], verdict: "incorrect" }, speech_metrics: null, created_at: "2026-09-02T10:02:00Z" },
    { interview_id: "iv-pg", eval: { score: 3, tags: ["locking"], verdict: "partially_correct" }, speech_metrics: null, created_at: "2026-09-02T10:03:00Z" },
  ];

  check("stacksWithData finds both technologies", JSON.stringify(stacksWithData(interviews).sort()) === '["postgresql","react"]', JSON.stringify(stacksWithData(interviews)));

  const all = aggregateSkills(rows);
  const reactOnly = aggregateSkills(filterByStack(rows, interviews, "react").rows);
  const pgOnly = aggregateSkills(filterByStack(rows, interviews, "postgresql").rows);

  const avg = (s: typeof all) =>
    s.length ? s.reduce((a, b) => a + b.score, 0) / s.length : 0;

  check("the merged view sits between the two", avg(all) > avg(pgOnly) && avg(all) < avg(reactOnly), `all ${avg(all)}, react ${avg(reactOnly)}, pg ${avg(pgOnly)}`);
  check("React scores high on its own", avg(reactOnly) >= 80, `${avg(reactOnly)}`);
  check("PostgreSQL scores low on its own", avg(pgOnly) <= 30, `${avg(pgOnly)}`);
  check("React skills exclude PostgreSQL tags", !reactOnly.some((s) => ["indexes", "transactions", "locking"].includes(s.skill)));
  check("PostgreSQL skills exclude React tags", !pgOnly.some((s) => ["hooks", "state", "rendering"].includes(s.skill)));

  check(
    "an interview covering both appears under both stacks",
    filterByStack(rows, interviews, "react").interviews.some((iv) => iv.id === "iv-both") &&
      filterByStack(rows, interviews, "postgresql").interviews.some((iv) => iv.id === "iv-both")
  );
  check("a null stack means all stacks", filterByStack(rows, interviews, null).rows.length === rows.length);
  check("an unknown stack yields nothing", filterByStack(rows, interviews, "rust").rows.length === 0);

  section("Unanswered questions are a coverage gap, not a score of zero");

  const withSkips: EvalTurnRow[] = [
    { interview_id: "iv-react", eval: { score: 9, tags: ["hooks"], verdict: "correct" }, speech_metrics: null, created_at: "2026-09-01T10:01:00Z" },
    { interview_id: "iv-react", eval: { score: 0, tags: ["hooks"], verdict: "unanswered" }, speech_metrics: null, created_at: "2026-09-01T10:02:00Z" },
    { interview_id: "iv-react", eval: { score: 0, tags: ["ssr"], verdict: "unanswered" }, speech_metrics: null, created_at: "2026-09-01T10:03:00Z" },
  ];
  const skills = aggregateSkills(withSkips);
  const hooks = skills.find((s) => s.skill === "hooks");
  check("a skipped question doesn't drag the score down", hooks?.score === 90, `${hooks?.score}`);
  check("the skip is still counted", hooks?.skipped === 1, `${hooks?.skipped}`);
  check("a skill with only skips is left off the radar", !skills.some((s) => s.skill === "ssr"));

  const heat = buildHeatmap(withSkips, interviews);
  check("the heatmap ignores unanswered rows too", heat.rows.every((r) => r.avg > 0), JSON.stringify(heat.rows.map((r) => [r.skill, r.avg])));

  section("Legacy interviews without stack_ids");

  const legacy: InterviewMeta[] = [
    { id: "old", started_at: "2026-08-01T10:00:00Z", role_track: "React + Node.js" },
  ];
  check("legacy rounds contribute no stack tabs", stacksWithData(legacy).length === 0);
  check(
    "legacy rounds still show under All stacks",
    filterByStack(
      [{ interview_id: "old", eval: { score: 5, tags: ["x"] }, speech_metrics: null, created_at: "2026-08-01T10:01:00Z" }],
      legacy,
      null
    ).rows.length === 1
  );
}

function main() {
  testPersistenceAndCounts();
  testDayRollover();
  testStackChanges();
  testMultiStackAggregation();

  console.log(
    failures === 0
      ? "\nALL DRILL & MULTI-STACK CHECKS PASSED"
      : `\n${failures} CHECKS FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
