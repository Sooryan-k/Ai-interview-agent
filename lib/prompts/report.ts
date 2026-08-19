import { stripAnswerMarkers } from "@/lib/schemas";

interface ReportTurn {
  speaker: string;
  text: string;
  eval?: {
    score: number;
    note: string;
    tags: string[];
    depth?: number;
  } | null;
}

/** Extra framing for rounds whose report shouldn't read like a generic Q&A. */
const ROUND_FRAMING: Record<string, string> = {
  depth: `This was a DEPTH LADDER: one topic, drilled deeper every rung until the candidate hit their ceiling. Frame the whole report around that ceiling.
- "overall_score" should reflect how deep they got before stalling, not how many questions they answered.
- Put the ceiling in the FIRST weakness, stated concretely: the specific concept they could not explain, and the rung it happened on.
- "per_question" is one entry per rung, in order, so they can see the climb.
- Recommendations must target the exact gap that stopped them, not the topic in general.`,
  repo: `This interview was about a repository the candidate wrote themselves. Judge how well they defended their OWN design decisions — clarity on trade-offs, awareness of failure modes, and honesty about what they'd change. Do not judge the code's quality itself; judge their ability to explain and defend it. Reference specific files or decisions they discussed.`,
};

export function reportPrompt(args: {
  roleTrack: string;
  roundType: string;
  difficulty: string;
  turns: ReportTurn[];
}): string {
  const transcript = args.turns
    .map((t) => {
      // Answer-highlight markers are a UI concern; keep them out of the model's view.
      const line = `${t.speaker === "ai" ? "INTERVIEWER" : "CANDIDATE"}: ${stripAnswerMarkers(t.text)}`;
      if (!t.eval) return line;
      const rung =
        typeof t.eval.depth === "number" ? ` — rung ${t.eval.depth}` : "";
      return `${line}\n[private per-answer eval: score ${t.eval.score}/10${rung} — ${t.eval.note}]`;
    })
    .join("\n\n");

  const framing = ROUND_FRAMING[args.roundType];

  return `You are a senior hiring-committee reviewer writing a candid, constructive report card for a mock interview.

Interview: ${args.roleTrack} — ${args.roundType} round — ${args.difficulty} difficulty.
${framing ? `\n${framing}\n` : ""}
Full transcript (with private per-answer evaluations where available):

${transcript}

Write the report as STRICT JSON only, matching exactly:
{
  "overall_score": number,          // 0-100, calibrated: 50 = borderline, 70 = solid pass, 85+ = strong hire signal
  "strengths": string[],            // 2-4 specific strengths, each citing evidence from the transcript
  "weaknesses": string[],           // 2-4 specific gaps, each actionable
  "per_question": [                 // one entry per main interviewer question
    {
      "q": string,                  // the question, shortened
      "answer_summary": string,     // 1-2 sentences on what the candidate said
      "model_answer": string,       // 2-4 sentences: what a great answer includes
      "score": number               // 0-10
    }
  ],
  "recommendations": string[]       // 2-4 concrete next steps ("Re-study X", "Practice Y aloud"), most impactful first
}

Rules: be specific, never generic. Quote or paraphrase the candidate where useful. No commentary outside the JSON object.`;
}
