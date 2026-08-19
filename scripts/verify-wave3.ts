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
import { panelistEmoji, splitSpeakerTag, stripSpeakerTag } from "@/lib/panel";
import {
  interviewerSystemPrompt,
  transcriptPrompt,
} from "@/lib/prompts/interviewer";
import { reportPrompt } from "@/lib/prompts/report";
import {
  EvalSchema,
  ANSWER_OPEN,
  ANSWER_CLOSE,
  END_MARKER,
  splitAnswerSegments,
  stripAnswerMarkers,
} from "@/lib/schemas";
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

  // ---- difficulty ramp ----
  const mk = (difficulty: string, roundType = "technical") =>
    interviewerSystemPrompt({
      roleTrack: "React",
      roundType,
      difficulty,
      interviewerName: "Alex",
      questionCount: 6,
    });
  const easy = mk("easy");
  const medium = mk("medium");
  const hard = mk("hard");

  check("ramp: easy opens with fundamentals", /DIFFICULTY RAMP/.test(easy));
  check(
    "ramp: easy names the stack in the opener rule",
    easy.includes('"what is X, and why does it exist" about the most central concept in React')
  );
  check("ramp: easy stays approachable throughout", /EASY round/.test(easy));
  check("ramp: medium ramps to a mid-level bar", /MEDIUM round/.test(medium));
  check(
    "ramp: forbids jumping ahead on a strong answer",
    /Never jump to the hardest material early/.test(medium)
  );
  check("ramp: hard is NOT ramped", !/DIFFICULTY RAMP/.test(hard));
  check(
    "ramp: hard keeps the adaptive rule instead",
    /Adapt difficulty as you go/.test(hard)
  );
  check(
    "ramp: skipped for conversational rounds (hr, negotiation)",
    !/DIFFICULTY RAMP/.test(mk("easy", "hr")) &&
      !/DIFFICULTY RAMP/.test(mk("easy", "negotiation"))
  );
  check(
    "ramp: never collides with the depth ladder's own plan",
    !/DIFFICULTY RAMP/.test(mk("easy", "depth"))
  );

  // ---- reveal-answer turn ----
  const history = [
    { speaker: "ai", text: "What is a React key?" },
  ];
  const revealTurn = transcriptPrompt(history, undefined, { reveal: true });
  check(
    "reveal: gives the answer rather than withholding it",
    /The answer itself/.test(revealTurn)
  );
  check(
    "reveal: advances to the next question",
    /ask your NEXT question/.test(revealTurn)
  );
  check(
    "reveal: emits a null eval since nothing was answered",
    /output null for the eval JSON/.test(revealTurn)
  );
  check(
    "reveal: stays speakable (no markdown in the spoken answer)",
    /no markdown, no bullets, no code blocks/.test(revealTurn)
  );

  const hintTurn = transcriptPrompt(history, undefined, { hint: true });
  check(
    "hint: still withholds the full answer",
    /without giving the full answer/.test(hintTurn)
  );
  check(
    "hint: does not advance the question",
    /do not advance to a new question/.test(hintTurn)
  );
  check(
    "reveal and hint are distinct prompts",
    revealTurn !== hintTurn &&
      !/do not advance to a new question/.test(revealTurn)
  );

  check(
    "reveal: asks for the shortest satisfying answer",
    /SHORTEST answer/.test(revealTurn) && /under 45 words/.test(revealTurn)
  );
  check(
    "reveal: marks only the answer, not the lead-in or next question",
    revealTurn.includes(ANSWER_OPEN) &&
      revealTurn.includes(ANSWER_CLOSE) &&
      /ONLY the answer between the markers/.test(revealTurn)
  );
  check(
    "reveal: forbids ending the interview",
    /the interview CONTINUES/i.test(revealTurn) &&
      revealTurn.includes(`Do NOT output ${END_MARKER}`)
  );
  check(
    "reveal: is explicitly not the depth-ladder ceiling",
    /NOT the candidate's ceiling/i.test(revealTurn)
  );
  check(
    "depth ladder: carves out hints/reveals from its ceiling rule",
    /EXCEPTION: if the candidate asks for a hint or asks to be shown the answer/.test(
      depthPrompt
    ) && /NOT the ceiling/i.test(depthPrompt)
  );

  // ---- answer-marker parsing ----
  const marked = `Sure. ${ANSWER_OPEN}A key helps React match items.${ANSWER_CLOSE} Next: what is state?`;
  const segs = splitAnswerSegments(marked);
  check("markers: splits into three segments", segs.length === 3);
  check(
    "markers: highlights only the answer",
    segs[1].isAnswer &&
      segs[1].text === "A key helps React match items." &&
      !segs[0].isAnswer &&
      !segs[2].isAnswer
  );
  check(
    "markers: reassembles to the original words",
    segs.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim() ===
      "Sure. A key helps React match items. Next: what is state?"
  );
  check(
    "markers: plain text passes through untouched",
    splitAnswerSegments("just a question?").length === 1 &&
      splitAnswerSegments("just a question?")[0].isAnswer === false
  );
  check(
    "markers: unterminated marker degrades to plain text, keeps the words",
    (() => {
      const s = splitAnswerSegments(`Sure. ${ANSWER_OPEN}half arrived`);
      return s.every((x) => !x.isAnswer) && s.map((x) => x.text).join("").includes("half arrived");
    })()
  );

  check(
    "strip: removes complete markers for speech",
    stripAnswerMarkers(marked) === "Sure. A key helps React match items. Next: what is state?"
  );
  check(
    "strip: hides a partial marker at the stream tail",
    stripAnswerMarkers("Sure. [[") === "Sure. " &&
      stripAnswerMarkers("Sure. [[/A") === "Sure. "
  );
  check(
    "strip: leaves ordinary brackets alone",
    stripAnswerMarkers("Use arr[0] here.") === "Use arr[0] here."
  );

  // Models mangle the closer in practice; these are variants seen in the wild
  // plus the legacy bracket markers already sitting in stored transcripts.
  const variants: [string, string][] = [
    ["mangled closer [/A]] (observed)", "Lead. [[A]]The answer.[/A]] Next?"],
    ["legacy bracket pair", "Lead. [[A]]The answer.[[/A]] Next?"],
    ["spelled-out tags", "Lead. [[ANSWER]]The answer.[[/ANSWER]] Next?"],
    ["lowercase xml", "Lead. <ans>The answer.</ans> Next?"],
    ["spaced xml", "Lead. < ANS >The answer.< / ANS > Next?"],
  ];
  for (const [label, raw] of variants) {
    const s = splitAnswerSegments(raw);
    const answer = s.find((x) => x.isAnswer);
    check(
      `markers: recovers from ${label}`,
      answer?.text === "The answer." && s.length === 3,
      JSON.stringify(s)
    );
    check(
      `strip: removes ${label}`,
      !/\[\[|\]\]|<\s*\/?\s*ans/i.test(stripAnswerMarkers(raw)),
      stripAnswerMarkers(raw)
    );
  }

  check(
    "strip: hides a partial xml tag at the stream tail",
    stripAnswerMarkers("Sure. <") === "Sure. " &&
      stripAnswerMarkers("Sure. </AN") === "Sure. "
  );
  check(
    "strip: does not eat a real comparison operator mid-sentence",
    stripAnswerMarkers("Use a < b to compare.") === "Use a < b to compare."
  );

  // ---- early-finish sign-off ----
  const wrapTurn = transcriptPrompt(history, undefined, { wrapUp: true });
  check(
    "wrapUp: asks for a warm closing statement",
    /Thank them for their time/.test(wrapTurn)
  );
  check("wrapUp: ends the interview", wrapTurn.includes(END_MARKER));
  check(
    "wrapUp: does not ask another question",
    /Do NOT ask another question/.test(wrapTurn)
  );
  check(
    "wrapUp: leaves scoring to the report",
    /Do NOT give scores, detailed feedback/.test(wrapTurn)
  );
  check(
    "wrapUp: won't invent praise for an empty interview",
    /rather than inventing praise/.test(wrapTurn)
  );
  check(
    "wrapUp, hint and reveal are three distinct prompts",
    new Set([wrapTurn, hintTurn, revealTurn]).size === 3
  );
  check(
    "wrapUp(early): says the candidate chose to stop",
    /chosen to finish the interview here/.test(
      transcriptPrompt(history, undefined, {
        wrapUp: true,
        wrapUpReason: "early",
      })
    )
  );
  const outOfQuestions = transcriptPrompt(history, undefined, {
    wrapUp: true,
    wrapUpReason: "complete",
  });
  check(
    "wrapUp(complete): says the questions ran out, not that they quit",
    /used up all of its planned questions/.test(outOfQuestions) &&
      !/chosen to finish/.test(outOfQuestions)
  );
  check(
    "wrapUp(complete): forbids one more question",
    /do not ask another one/i.test(outOfQuestions)
  );

  // ---- panel speaker tags ----
  const tagged = splitSpeakerTag("[Priya] So, tell me about scaling.");
  check(
    "panel: lifts the speaker out of the message",
    tagged.speaker === "Priya" &&
      tagged.body === "So, tell me about scaling."
  );
  check(
    "panel: untagged messages are untouched",
    splitSpeakerTag("Plain question?").speaker === null &&
      splitSpeakerTag("Plain question?").body === "Plain question?"
  );
  check(
    "panel: a bracketed list marker is not mistaken for a speaker",
    splitSpeakerTag("[1] First point.").speaker === null
  );
  check(
    "panel: tag never reaches text-to-speech",
    stripSpeakerTag("[Marcus] Explain indexes.", true) === "Explain indexes."
  );
  check(
    "panel: a half-streamed tag is hidden too",
    stripSpeakerTag("[Mar", true) === "" &&
      stripSpeakerTag("[Marcus]", true) === ""
  );
  check(
    "panel: solo rounds never strip (a real bracket must survive)",
    stripSpeakerTag("[1] First point.", false) === "[1] First point."
  );
  check(
    "panel: female personas get the female face",
    ["Priya", "Dana", "Sofia", "Amara"].every(
      (n) => panelistEmoji(n) === "👩"
    )
  );
  check(
    "panel: everyone else gets the male face",
    ["Marcus", "Ken", "Alex", "Jordan"].every(
      (n) => panelistEmoji(n) === "👨"
    )
  );
  check(
    "panel: matching is case-insensitive and space-tolerant",
    panelistEmoji(" priya ") === "👩" && panelistEmoji("PRIYA") === "👩"
  );
  check(
    "panel: only ever a person emoji, never a role object",
    ["Priya", "Marcus", "Dana", "Jordan"].every((n) =>
      ["👩", "👨"].includes(panelistEmoji(n))
    )
  );

  // ---- interviewer name is not exposed ----
  const named = interviewerSystemPrompt({
    roleTrack: "React",
    roundType: "technical",
    difficulty: "medium",
    interviewerName: "Sofia",
    questionCount: 12,
  });
  check(
    "identity: solo interviewer is told not to give a name",
    /Never state or introduce yourself by name/.test(named)
  );
  const panel = interviewerSystemPrompt({
    roleTrack: "React",
    roundType: "technical",
    difficulty: "medium",
    interviewerName: "Sofia",
    questionCount: 12,
    panel: true,
  });
  check(
    "identity: panel rounds keep names (they identify the speaker)",
    !/Never state or introduce yourself by name/.test(panel) &&
      panel.includes("[Priya]")
  );

  const plainTurn = transcriptPrompt(history, "my answer");
  check(
    "normal turn is unaffected by the new options object",
    /Produce your next interviewer message now/.test(plainTurn) &&
      plainTurn.includes("CANDIDATE: my answer")
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
