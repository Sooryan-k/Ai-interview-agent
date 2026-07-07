/**
 * Offline verification of the AI wire protocol in mock mode:
 * - streamText yields chunks; sentinel + eval JSON parse correctly per turn
 * - curriculum / study / report fixtures validate against the zod schemas
 * - sentinel holdback logic never leaks eval text to the "client"
 */
process.env.GEMINI_MOCK = "1";

import { streamText, generateText, parseJsonLoose } from "@/lib/gemini";
import {
  CurriculumSchema,
  StudyMaterialSchema,
  ReportSchema,
  EvalSchema,
  EVAL_SENTINEL,
  END_MARKER,
} from "@/lib/schemas";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

async function main() {
  // 1. Structured fixtures validate.
  const cur = CurriculumSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "smart", prompt: "", json: true, mockKind: "curriculum" }))
  );
  check("curriculum fixture matches schema", cur.success, JSON.stringify(cur.success ? "" : cur.error.issues[0]));

  const study = StudyMaterialSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "turn", prompt: "", json: true, mockKind: "study" }))
  );
  check("study fixture matches schema", study.success);

  const report = ReportSchema.safeParse(
    parseJsonLoose(await generateText({ tier: "smart", prompt: "", json: true, mockKind: "report" }))
  );
  check("report fixture matches schema", report.success);

  // 2. Interview turns: stream, apply the same holdback logic as the route.
  for (let turnIdx = 0; turnIdx < 4; turnIdx++) {
    let full = "";
    let forwarded = 0;
    let sentinelHit = false;
    let clientSees = "";

    const forwardUpTo = (limit: number) => {
      if (limit > forwarded) {
        clientSees += full.slice(forwarded, limit);
        forwarded = limit;
      }
    };

    for await (const chunk of streamText({ tier: "turn", prompt: "", mockKind: "turn", mockTurnIdx: turnIdx })) {
      full += chunk;
      if (sentinelHit) continue;
      const at = full.indexOf(EVAL_SENTINEL);
      if (at !== -1) {
        forwardUpTo(at);
        sentinelHit = true;
      } else {
        forwardUpTo(Math.max(0, full.length - EVAL_SENTINEL.length));
      }
    }
    if (!sentinelHit) forwardUpTo(full.length);

    check(`turn ${turnIdx}: sentinel present`, sentinelHit);
    check(
      `turn ${turnIdx}: client never sees sentinel/eval`,
      !clientSees.includes(EVAL_SENTINEL) && !clientSees.includes('"score"')
    );

    const evalRaw = full.slice(full.indexOf(EVAL_SENTINEL) + EVAL_SENTINEL.length).trim();
    if (turnIdx === 0) {
      check("turn 0: eval is null (no prior answer)", evalRaw === "null", evalRaw);
    } else {
      const parsed = EvalSchema.safeParse(JSON.parse(evalRaw));
      check(`turn ${turnIdx}: eval JSON parses`, parsed.success, evalRaw);
    }
    if (turnIdx === 3) {
      check("final turn carries END marker", clientSees.includes(END_MARKER));
    } else {
      check(`turn ${turnIdx}: no premature END marker`, !clientSees.includes(END_MARKER));
    }
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
