/**
 * Wave 3 logic verification: delivery metrics, depth-ladder + repo prompts,
 * and GitHub URL parsing. Pure functions only — zero network, zero quota.
 * Run: npx tsx scripts/verify-wave3.ts
 */
process.env.GEMINI_MOCK = "1";

import {
  countFillers,
  countHedges,
  clarityScore,
  clarityLabel,
  per100Words,
} from "@/lib/speech/delivery";
import { parseRepoRef } from "@/lib/github";
import { interviewerSystemPrompt } from "@/lib/prompts/interviewer";
import { reportPrompt } from "@/lib/prompts/report";
import { EvalSchema } from "@/lib/schemas";
import { aggregateDelivery, type EvalTurnRow } from "@/lib/analytics";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

function main() {
  // ---- filler vs hedge counting ----
  check("fillers: counts basic tics", countFillers("um, uh, you know") === 3);
  check(
    "hedges: counts weak-commitment phrases",
    countHedges("I think maybe this is probably right") === 3,
    String(countHedges("I think maybe this is probably right"))
  );
  check(
    "hedges: tolerates missing/curly apostrophes",
    countHedges("Im not sure") === 1 &&
      countHedges("I’m not sure") === 1 &&
      countHedges("I'm not sure") === 1
  );
  check(
    "hedges: the two lists never double-count the same phrase",
    // "sort of"/"kind of" are fillers; they must not also register as hedges.
    countFillers("sort of, kind of") === 2 && countHedges("sort of, kind of") === 0
  );
  check("hedges: clean answer scores zero", countHedges("Yes. B-trees keep it sorted.") === 0);
  check(
    "fillers: word-boundary safe",
    countFillers("aluminium") === 0 && countFillers("likely") === 0
  );

  // ---- clarity ----
  check("clarity: null when browser reports nothing", clarityScore([]) === null);
  check(
    "clarity: ignores zero/invalid confidences rather than scoring them 0",
    clarityScore([0, 0.9, 0.9]) === 90
  );
  check("clarity: averages to 0-100", clarityScore([0.8, 0.6]) === 70);
  check("clarity label: high is good", clarityLabel(90).tone === "good");
  check("clarity label: low is poor", clarityLabel(40).tone === "poor");

  // ---- rate normalisation ----
  check("per100Words: scales by answer length", per100Words(3, "a ".repeat(150)) === 2);
  check("per100Words: empty text is 0", per100Words(3, "   ") === 0);

  // ---- GitHub URL parsing ----
  const parsed = parseRepoRef("https://github.com/owner/name");
  check(
    "repo: parses https URL",
    parsed?.owner === "owner" && parsed?.repo === "name"
  );
  check(
    "repo: strips .git and deep paths",
    parseRepoRef("https://github.com/o/n.git")?.repo === "n" &&
      parseRepoRef("https://github.com/o/n/tree/main/src")?.repo === "n"
  );
  check("repo: accepts ssh form", parseRepoRef("git@github.com:o/n.git")?.owner === "o");
  check("repo: accepts bare owner/repo", parseRepoRef("o/n")?.repo === "n");
  check(
    "repo: rejects junk",
    parseRepoRef("not a repo") === null && parseRepoRef("") === null
  );

  // ---- depth-ladder prompt ----
  const depthPrompt = interviewerSystemPrompt({
    roleTrack: "Postgres",
    roundType: "depth",
    difficulty: "medium",
    interviewerName: "Alex",
    questionCount: 8,
    depthTopic: "database indexing",
  });
  check("depth: names the fixed topic", depthPrompt.includes("database indexing"));
  check("depth: instructs to stop at the ceiling", /ceiling/i.test(depthPrompt));
  check(
    "depth: asks for the rung in the eval JSON",
    depthPrompt.includes('"depth"')
  );
  check(
    "depth: does not use the standard N-questions plan",
    !depthPrompt.includes("Ask exactly 8 main questions")
  );

  const normalPrompt = interviewerSystemPrompt({
    roleTrack: "React",
    roundType: "technical",
    difficulty: "medium",
    interviewerName: "Alex",
    questionCount: 6,
  });
  check(
    "normal round keeps the standard plan",
    normalPrompt.includes("Ask exactly 6 main questions")
  );
  check(
    "normal round omits the depth field from the eval shape",
    !normalPrompt.includes('"depth"')
  );

  // ---- repo prompt ----
  const repoPrompt = interviewerSystemPrompt({
    roleTrack: "TypeScript",
    roundType: "repo",
    difficulty: "medium",
    interviewerName: "Alex",
    questionCount: 6,
    repo: { label: "me/proj", digest: "FILE TREE:\nsrc/index.ts" },
  });
  check("repo: embeds the digest", repoPrompt.includes("src/index.ts"));
  check("repo: labels the repository", repoPrompt.includes("me/proj"));
  check(
    "repo: forbids inventing code that isn't in the digest",
    /NEVER invent/i.test(repoPrompt)
  );

  // ---- eval schema carries the rung ----
  const withDepth = EvalSchema.parse({
    score: 7,
    note: "ok",
    tags: ["indexes"],
    depth: 4,
  });
  check("eval: keeps the depth rung", withDepth.depth === 4);
  const noDepth = EvalSchema.parse({ score: 7, note: "ok", tags: [] });
  check("eval: depth is optional", noDepth.depth === undefined);

  // ---- report prompt framing ----
  const depthReport = reportPrompt({
    roleTrack: "Postgres",
    roundType: "depth",
    difficulty: "medium",
    turns: [
      { speaker: "ai", text: "What is an index?" },
      {
        speaker: "user",
        text: "A lookup structure.",
        eval: { score: 6, note: "surface", tags: [], depth: 2 },
      },
    ],
  });
  check("report: frames depth rounds around the ceiling", /ceiling/i.test(depthReport));
  check("report: surfaces the rung in the transcript", depthReport.includes("rung 2"));

  const repoReport = reportPrompt({
    roleTrack: "TS",
    roundType: "repo",
    difficulty: "medium",
    turns: [{ speaker: "ai", text: "Why this structure?" }],
  });
  check(
    "report: repo rounds judge defence, not code quality",
    /defend/i.test(repoReport)
  );

  // ---- delivery aggregation carries the new signals ----
  const mkRow = (
    hedges: number,
    clarity: number | null
  ): EvalTurnRow => ({
    interview_id: "iv1",
    eval: { score: 7 },
    speech_metrics: { wpm: 140, fillers: 2, hedges, long_pauses: 1, clarity },
    created_at: "2026-08-19T00:00:00Z",
  });
  const { points } = aggregateDelivery(
    [mkRow(3, 80), mkRow(2, 60)],
    [{ id: "iv1", started_at: "2026-08-19T00:00:00Z", role_track: "TS" }]
  );
  check("delivery: sums hedges", points[0]?.hedges === 5);
  check("delivery: averages clarity", points[0]?.clarity === 70);

  const { points: noClarity } = aggregateDelivery(
    [mkRow(1, null)],
    [{ id: "iv1", started_at: "2026-08-19T00:00:00Z", role_track: "TS" }]
  );
  check(
    "delivery: unmeasured clarity stays null (not 0)",
    noClarity[0]?.clarity === null
  );

  console.log(
    failures === 0
      ? "\nALL WAVE-3 CHECKS PASSED"
      : `\n${failures} WAVE-3 CHECK(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
