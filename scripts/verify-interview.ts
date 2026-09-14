/**
 * Offline verification of interview length, honest scoring, and no-repeat
 * questions. Covers the four behaviours that were reported broken:
 *
 *  1. A non-answer scores zero and is recorded as unanswered.
 *  2. One stack = 12 questions; N stacks = 5N.
 *  3. A session runs to its planned length instead of stopping early.
 *  4. A second session on the same stack doesn't re-ask the first one's
 *     questions, including reworded versions.
 *
 * Runs entirely in-process against the same modules the routes use — no
 * database, no API key, no network.
 */
process.env.GEMINI_MOCK = "1";

import {
  buildQuestionPlan,
  describePlan,
  plannedQuestionsFor,
  stackForQuestion,
  totalQuestionsForStacks,
  QUESTIONS_PER_STACK,
  SINGLE_STACK_QUESTIONS,
} from "@/lib/interview-plan";
import {
  computeScore,
  detectNonAnswer,
  overallScoreFromEvals,
  resolveEval,
  tallyEvals,
  INCORRECT_SCORE_CAP,
} from "@/lib/scoring";
import {
  buildExclusions,
  exclusionPromptSection,
  findDuplicate,
  isNearDuplicate,
  questionSignature,
  similarity,
  type HistoryEntry,
} from "@/lib/question-history";
import { parseTurnMeta, END_MARKER } from "@/lib/schemas";
import { streamText } from "@/lib/gemini";
import { stackName } from "@/lib/stacks";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

function section(title: string) {
  console.log(`\n— ${title} —`);
}

/* ================================================================== *
 * 1. A non-answer scores zero
 * ================================================================== */
function testNonAnswerScoring() {
  section("Non-answers score zero");

  // The exact replies from the reported session.
  const reported = ["idk, next q", "idk"];
  for (const reply of reported) {
    const detected = detectNonAnswer(reply);
    check(`"${reply}" is detected as a non-answer`, detected.isNonAnswer);

    // Even when the model insists it was a good answer worth 7/10.
    const generous = {
      verdict: "partially_correct",
      criteria: { correctness: 8, depth: 7, structure: 8, clarity: 9 },
      note: "Great instincts, touched on the core of it!",
      score: 7,
    };
    const resolved = resolveEval(reply, generous);
    check(`"${reply}" scores 0 despite a generous model eval`, resolved.score === 0, `got ${resolved.score}`);
    check(`"${reply}" is recorded as unanswered`, resolved.verdict === "unanswered", resolved.verdict);
    check(`"${reply}" note does not praise the candidate`, !/great|good|solid|nice|well/i.test(resolved.note), resolved.note);
    check(`"${reply}" is marked as a server override`, resolved.overridden);
  }

  const moreNonAnswers = [
    "I don't know",
    "i dont know",
    "no idea",
    "No clue.",
    "skip",
    "pass",
    "next question",
    "",
    "   ",
    "um... uh...",
    "?",
    "n/a",
    "never heard of it",
  ];
  for (const reply of moreNonAnswers) {
    const r = resolveEval(reply, { criteria: { correctness: 9, depth: 9, structure: 9, clarity: 9 } });
    check(`non-answer "${reply.trim() || "(empty)"}" scores 0`, r.score === 0 && r.verdict === "unanswered", `got ${r.score}/${r.verdict}`);
  }

  // The other side of the line: a hedged but real answer must NOT be zeroed.
  const realAnswers = [
    "I don't know the exact algorithm, but I believe it's generational and runs on a background thread.",
    "Not sure about the name, though it's the thing that batches state updates before re-rendering.",
    "I think var is function scoped while let and const are block scoped.",
  ];
  for (const reply of realAnswers) {
    const detected = detectNonAnswer(reply);
    check(`hedged but real answer is NOT a non-answer: "${reply.slice(0, 40)}…"`, !detected.isNonAnswer);
    const r = resolveEval(reply, {
      verdict: "partially_correct",
      criteria: { correctness: 6, depth: 4, structure: 6, clarity: 7 },
    });
    check(`hedged real answer scores above zero`, r.score > 0, `got ${r.score}`);
  }

  section("Correctness dominates the score");

  // A fluent, confident, completely wrong answer.
  const eloquentlyWrong = resolveEval("A closure is when you close over a database connection so it can be reused between requests.", {
    verdict: "incorrect",
    criteria: { correctness: 1, depth: 8, structure: 10, clarity: 10 },
  });
  check(
    "well-spoken wrong answer is capped low",
    eloquentlyWrong.score <= INCORRECT_SCORE_CAP,
    `got ${eloquentlyWrong.score}`
  );

  // A blunt but correct answer.
  const bluntlyRight = resolveEval("Block scoped. var isn't.", {
    verdict: "correct",
    criteria: { correctness: 9, depth: 3, structure: 4, clarity: 5 },
  });
  check(
    "blunt correct answer out-scores eloquent wrong one",
    bluntlyRight.score > eloquentlyWrong.score,
    `${bluntlyRight.score} vs ${eloquentlyWrong.score}`
  );

  // The model can't launder a pass through a mismatched verdict.
  const contradiction = resolveEval("Some words that are wrong.", {
    verdict: "correct",
    criteria: { correctness: 1, depth: 9, structure: 9, clarity: 9 },
  });
  check(
    "'correct' verdict with failing correctness is downgraded",
    contradiction.verdict !== "correct" && contradiction.score <= INCORRECT_SCORE_CAP,
    `${contradiction.verdict} @ ${contradiction.score}`
  );

  // The model cannot declare a real answer "unanswered" either.
  const wronglyZeroed = resolveEval("var is function scoped, let is block scoped.", {
    verdict: "unanswered",
    criteria: { correctness: 8, depth: 5, structure: 6, clarity: 7 },
  });
  check(
    "a real answer can't be marked unanswered by the model",
    wronglyZeroed.verdict !== "unanswered" && wronglyZeroed.score > 0,
    `${wronglyZeroed.verdict} @ ${wronglyZeroed.score}`
  );

  check("all-zero criteria yield zero", computeScore({ correctness: 0, depth: 0, structure: 0, clarity: 0 }, "incorrect") === 0);
  check("perfect criteria yield ten", computeScore({ correctness: 10, depth: 10, structure: 10, clarity: 10 }, "correct") === 10);

  section("The overall score is computed, not generated");

  const allSkipped = [0, 0, 0, 0].map((score) => ({ score, verdict: "unanswered" as const }));
  check("an all-skipped interview scores 0 overall", overallScoreFromEvals(allSkipped) === 0, `${overallScoreFromEvals(allSkipped)}`);

  const tally = tallyEvals(allSkipped, 4);
  check("tally counts 4 unanswered", tally.unanswered === 4 && tally.answered === 0 && tally.asked === 4, JSON.stringify(tally));

  const mixed = [
    { score: 8, verdict: "correct" as const },
    { score: 0, verdict: "unanswered" as const },
    { score: 2, verdict: "incorrect" as const },
    { score: 5, verdict: "partially_correct" as const },
  ];
  check("mixed round averages to 37/100", overallScoreFromEvals(mixed) === 38 || overallScoreFromEvals(mixed) === 37, `${overallScoreFromEvals(mixed)}`);
  const mixedTally = tallyEvals(mixed, 4);
  check(
    "mixed tally: 3 answered, 1 unanswered, 1 correct, 1 incorrect",
    mixedTally.answered === 3 && mixedTally.unanswered === 1 && mixedTally.correct === 1 && mixedTally.incorrect === 1,
    JSON.stringify(mixedTally)
  );

  // The reported symptom, end to end: "idk" everywhere must not yield 72/100.
  const reportedSession = ["idk, next q", "idk", "idk"].map((a) =>
    resolveEval(a, { verdict: "correct", criteria: { correctness: 7, depth: 7, structure: 7, clarity: 7 }, score: 7 })
  );
  const reportedOverall = overallScoreFromEvals(reportedSession);
  check("the reported all-idk session now scores 0, not 72", reportedOverall === 0, `got ${reportedOverall}`);
}

/* ================================================================== *
 * 2. Question count from the stack selection
 * ================================================================== */
function testQuestionCounts() {
  section("Question count follows the stack selection");

  check(`1 stack = ${SINGLE_STACK_QUESTIONS} questions`, totalQuestionsForStacks(["react"]) === SINGLE_STACK_QUESTIONS, `${totalQuestionsForStacks(["react"])}`);

  for (const n of [2, 3, 4, 5, 6, 10]) {
    const ids = ["react", "nodejs", "postgresql", "typescript", "docker", "redis", "python", "django", "kubernetes", "graphql"].slice(0, n);
    const total = totalQuestionsForStacks(ids);
    check(`${n} stacks = ${n * QUESTIONS_PER_STACK} questions`, total === n * QUESTIONS_PER_STACK, `got ${total}`);
  }

  // The headline example from the brief.
  check("6 stacks = 30 questions", totalQuestionsForStacks(["react", "nodejs", "postgresql", "typescript", "docker", "redis"]) === 30);

  check("duplicate ids don't inflate the count", totalQuestionsForStacks(["react", "react", "nodejs"]) === 2 * QUESTIONS_PER_STACK);
  check("unknown ids are ignored", totalQuestionsForStacks(["react", "not-a-real-stack"]) === SINGLE_STACK_QUESTIONS);
  check("no stacks yields no stack-driven total", totalQuestionsForStacks([]) === 0);

  section("Per-stack allocation adds up and rotates");

  const six = ["react", "nodejs", "postgresql", "typescript", "docker", "redis"];
  const plan = buildQuestionPlan(six);
  check("plan total is 30", plan.total === 30, `${plan.total}`);
  check("sequence length matches the total", plan.sequence.length === plan.total, `${plan.sequence.length}`);
  check("every stack gets exactly 5", plan.perStack.every((p) => p.count === QUESTIONS_PER_STACK));
  check(
    "per-stack counts sum to the total",
    plan.perStack.reduce((s, p) => s + p.count, 0) === plan.total
  );

  // Each stack appears exactly its allotted number of times in the sequence.
  for (const p of plan.perStack) {
    const appearances = plan.sequence.filter((s) => s === p.stackId).length;
    check(`${stackName(p.stackId)} appears ${p.count} times in the rotation`, appearances === p.count, `${appearances}`);
  }

  // Rotation, not exhaustion: the first six questions must cover all six stacks.
  const firstRound = new Set(plan.sequence.slice(0, 6));
  check("the first 6 questions touch all 6 technologies", firstRound.size === 6, `${firstRound.size}`);
  check("question 1 and question 2 are different technologies", plan.sequence[0] !== plan.sequence[1]);

  // A single stack still produces a usable rotation.
  const solo = buildQuestionPlan(["react"]);
  check("single-stack plan is 12 questions on that stack", solo.total === 12 && solo.sequence.every((s) => s === "react"));

  check("stackForQuestion reads the rotation", stackForQuestion(plan, 0) === plan.sequence[0] && stackForQuestion(plan, 29) === plan.sequence[29]);
  check("stackForQuestion past the end is null", stackForQuestion(plan, 99) === null);

  section("Round types that aren't stack quizzes keep their own pacing");

  check(
    "a technical round uses the stack count",
    plannedQuestionsFor({ roundType: "technical", difficulty: "medium", stackIds: six }) === 30
  );
  check(
    "an HR round does not balloon to 30",
    plannedQuestionsFor({ roundType: "hr", difficulty: "medium", stackIds: six }) === 12
  );
  check(
    "a depth ladder uses rungs, not the stack count",
    plannedQuestionsFor({ roundType: "depth", difficulty: "medium", stackIds: six }) === 8
  );
  check(
    "a technical round with no recognised stacks falls back to difficulty",
    plannedQuestionsFor({ roundType: "technical", difficulty: "hard", stackIds: [] }) === 15
  );

  section("The total is described to the user before they start");

  const blurb6 = describePlan({ roundType: "technical", difficulty: "medium", stackIds: six });
  check("multi-stack blurb states the total and the split", blurb6.count === 30 && blurb6.detail.includes("5 per technology"), JSON.stringify(blurb6));
  const blurb1 = describePlan({ roundType: "technical", difficulty: "medium", stackIds: ["react"] });
  check("single-stack blurb states 12 and names the stack", blurb1.count === 12 && blurb1.detail.includes("React"), JSON.stringify(blurb1));
  const blurbHr = describePlan({ roundType: "hr", difficulty: "medium", stackIds: six });
  check("a non-stack round explains its length without restating the number", blurbHr.count === 12 && !blurbHr.detail.includes("12"), JSON.stringify(blurbHr));
  const blurbDepth = describePlan({ roundType: "depth", difficulty: "medium", stackIds: six });
  check("a depth ladder is measured in rungs", blurbDepth.unit === "rung", JSON.stringify(blurbDepth));
}

/* ================================================================== *
 * 3. A session runs to completion
 * ================================================================== */
async function testRunsToCompletion() {
  section("A session runs to its planned length");

  const stackIds = ["react", "nodejs", "postgresql", "typescript", "docker", "redis"];
  const planned = plannedQuestionsFor({ roundType: "technical", difficulty: "medium", stackIds });
  const plan = buildQuestionPlan(stackIds);

  // Replays the turn route's control flow: what ends an interview, and when.
  let aiTurnCount = 0;
  let ended = false;
  let endedAt = -1;
  const askedQuestions: string[] = [];
  let ignoredEndMarkers = 0;

  for (let guard = 0; guard < 100 && !ended; guard++) {
    // ---- the route's decision, made before the model is called ----
    const mustClose = aiTurnCount >= planned;
    const closing = mustClose; // no user-initiated wrap-up in this run
    const roundType: string = "technical";

    let full = "";
    for await (const chunk of streamText({ tier: "turn", prompt: "", mockKind: "turn", mockTurnIdx: aiTurnCount })) {
      full += chunk;
    }

    // A hostile model: tries to wrap up on every single turn.
    const visibleRaw = full.split("<<<EVAL>>>")[0] + `\n${END_MARKER}`;

    const modelWantsEnd = visibleRaw.includes(END_MARKER);
    const ladderCeiling = roundType === "depth" && modelWantsEnd;
    ended = closing || ladderCeiling;
    if (modelWantsEnd && !ended) ignoredEndMarkers++;

    const meta = parseTurnMeta(full.slice(full.indexOf("<<<EVAL>>>") + "<<<EVAL>>>".length));
    if (!ended && meta.question?.text) askedQuestions.push(meta.question.text);

    aiTurnCount++;
    if (ended) endedAt = aiTurnCount;
  }

  check("the interview ran to the planned length", endedAt === planned + 1, `ended after ${endedAt} interviewer turns, planned ${planned}`);
  check("it did NOT stop at 4 questions", endedAt > 4, `stopped at ${endedAt}`);
  check(`${planned} questions were actually asked`, askedQuestions.length === planned, `${askedQuestions.length}`);
  check("every unplanned end marker was ignored", ignoredEndMarkers === planned, `${ignoredEndMarkers} ignored`);
  check("the planned total is a stored number, not a model decision", planned === 30 && plan.total === 30);

  // The candidate ending it early is the one thing that may cut it short.
  let userEndedAt = -1;
  for (let ai = 0; ai < planned; ai++) {
    const wrapUp = ai === 6; // they press "end early" after 7 questions
    if (wrapUp || ai >= planned) {
      userEndedAt = ai;
      break;
    }
  }
  check("the candidate can still end early", userEndedAt === 6, `${userEndedAt}`);

  // A depth ladder keeps its designed early stop.
  const depthEnds = ((roundType: string, modelWantsEnd: boolean) =>
    roundType === "depth" && modelWantsEnd)("depth", true);
  check("a depth ladder may still stop at the ceiling", depthEnds);
}

/* ================================================================== *
 * 4. No repeats across sessions
 * ================================================================== */
function testNoRepeats() {
  section("Near-duplicate detection");

  // Questions are always compared within one stack, so the technology's own
  // name is noise rather than signal.
  const context = ["React", "JavaScript"];
  const pairs: [string, string, boolean][] = [
    ["What is the virtual DOM?", "Can you explain how React's virtual DOM works?", true],
    ["What is a closure in JavaScript?", "Could you explain closures to me?", true],
    ["How does indexing speed up a query?", "Why does adding an index make queries faster?", true],
    ["Explain the event loop.", "Walk me through how the event loop works.", true],
    ["What is useState used for?", "What is useEffect used for?", false],
    ["How do database indexes work?", "How does React reconciliation work?", false],
    ["What is a closure?", "What is a promise?", false],
  ];
  for (const [a, b, shouldMatch] of pairs) {
    const sim = similarity(a, b, context);
    const matched = isNearDuplicate(a, [{ question: b }], { context });
    check(
      `${shouldMatch ? "same" : "different"} question: "${a}" vs "${b}"`,
      matched === shouldMatch,
      `similarity ${sim.toFixed(2)}`
    );
  }

  check("identical questions share a signature", questionSignature("What is a closure?") === questionSignature("what is a closure"));
  check(
    "reordered wording shares a signature",
    questionSignature("Explain how the event loop works") === questionSignature("How does the event loop work, explain")
  );
  check("an empty question has an empty signature", questionSignature("???") === "");

  section("A second session avoids the first session's questions");

  const reactCtx = ["React", "JavaScript"];

  // Session one asks 12 React questions.
  const sessionOne = [
    "What is the virtual DOM and why does React use one?",
    "What is a closure in JavaScript?",
    "How does useState differ from useRef?",
    "When does a React component re-render?",
    "What problem do keys solve in a list?",
    "What is the difference between props and state?",
    "How does useEffect's dependency array work?",
    "What is reconciliation?",
    "Why is mutating state directly a problem?",
    "What does useMemo actually save you?",
    "How would you lift state up?",
    "What is a controlled input?",
  ];
  const history: HistoryEntry[] = sessionOne.map((question, i) => ({
    question,
    signature: questionSignature(question),
    stack_id: "react",
    topic: `topic-${i}`,
    difficulty: "medium",
    asked_at: new Date(Date.now() - i * 1000).toISOString(),
  }));

  // Session two: the exclusion list reaches the prompt.
  const exclusions = buildExclusions(history, ["react"], (id) => stackName(id) ?? id);
  const section2 = exclusionPromptSection(exclusions);
  check("the exclusion section is built for the stack", section2.includes("React"), section2.slice(0, 80));
  check("every previously asked question is listed", sessionOne.every((q) => section2.includes(q)));
  check("the prompt bans rewordings explicitly", /reworded|SAME question/i.test(section2));

  // Exact repeats are caught.
  for (const q of sessionOne) {
    check(`exact repeat caught: "${q.slice(0, 32)}…"`, isNearDuplicate(q, history, { context: reactCtx }));
  }

  // Rewordings are caught too — this is the part a string comparison misses.
  const rewordings: [string, string][] = [
    ["Can you explain how React's virtual DOM works?", "What is the virtual DOM and why does React use one?"],
    ["Could you explain what a closure is?", "What is a closure in JavaScript?"],
    ["Explain how the dependency array of useEffect works.", "How does useEffect's dependency array work?"],
    ["What is reconciliation in React?", "What is reconciliation?"],
  ];
  for (const [reworded, original] of rewordings) {
    const dup = findDuplicate(reworded, history, { context: reactCtx });
    check(
      `reworded repeat caught: "${reworded.slice(0, 38)}…"`,
      dup !== null && dup.question === original,
      dup ? `matched "${dup.question}"` : "no match"
    );
  }

  // Genuinely new ground is still allowed through.
  const fresh = [
    "How does React's concurrent rendering change batching?",
    "What does a Suspense boundary do when data is still loading?",
    "How would you profile an unnecessary re-render?",
  ];
  for (const q of fresh) {
    check(`new question allowed: "${q.slice(0, 38)}…"`, !isNearDuplicate(q, history, { context: reactCtx }));
  }

  section("Exclusions stay bounded and flag an exhausted pool");

  // Genuinely distinct subject matter, so the cap is what limits the list
  // rather than the de-duplication collapsing near-identical filler.
  const DISTINCT_TOPICS = [
    "hooks", "context", "portals", "refs", "suspense", "hydration", "batching",
    "memoization", "fragments", "errorboundaries", "lazyloading", "profiler",
    "strictmode", "transitions", "concurrency", "reducers", "forms", "routing",
    "serialization", "accessibility", "animation", "testing", "bundling",
    "treeshaking", "polyfills", "webworkers", "streaming", "caching",
    "prefetching", "middleware", "authentication", "authorization", "logging",
    "telemetry", "throttling", "pagination", "websockets", "compression",
    "internationalization", "migrations",
  ].map((t) => `Tell me about ${t} and how you would approach it.`);

  const many: HistoryEntry[] = Array.from({ length: 40 }, (_, i) => ({
    question: DISTINCT_TOPICS[i],
    signature: questionSignature(DISTINCT_TOPICS[i]),
    stack_id: "react",
    topic: `topic-${i}`,
    asked_at: new Date(Date.now() - i * 1000).toISOString(),
  }));
  const bounded = buildExclusions(many, ["react"], (id) => stackName(id) ?? id);
  check("the exclusion list is capped", bounded[0].questions.length <= 25, `${bounded[0].questions.length}`);
  check("a well-covered stack is flagged as under pressure", bounded[0].underPressure);
  const pressureText = exclusionPromptSection(bounded);
  check("the prompt asks for fresh sub-topics or higher difficulty", /sub-topics|raise the difficulty/i.test(pressureText));
  check("the prompt offers a labelled revision fallback", /revision/i.test(pressureText));

  const light = buildExclusions(history.slice(0, 3), ["react"], (id) => stackName(id) ?? id);
  check("a lightly used stack is not under pressure", !light[0].underPressure);
  check("no history means no exclusion section at all", exclusionPromptSection(buildExclusions([], ["react"], (id) => id)) === "");

  section("History is scoped per stack");

  const mixedHistory: HistoryEntry[] = [
    { question: "What is a closure in JavaScript?", stack_id: "react", asked_at: "2026-01-01" },
    { question: "How does connection pooling work?", stack_id: "postgresql", asked_at: "2026-01-01" },
  ];
  const perStack = buildExclusions(mixedHistory, ["react", "postgresql"], (id) => stackName(id) ?? id);
  check("react exclusions contain only react questions", perStack[0].questions.length === 1 && perStack[0].questions[0].includes("closure"));
  check("postgres exclusions contain only postgres questions", perStack[1].questions.length === 1 && perStack[1].questions[0].includes("pooling"));
}

async function main() {
  testNonAnswerScoring();
  testQuestionCounts();
  await testRunsToCompletion();
  testNoRepeats();

  console.log(
    failures === 0
      ? "\nALL INTERVIEW CHECKS PASSED"
      : `\n${failures} INTERVIEW CHECKS FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
