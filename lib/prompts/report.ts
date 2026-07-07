interface ReportTurn {
  speaker: string;
  text: string;
  eval?: { score: number; note: string; tags: string[] } | null;
}

export function reportPrompt(args: {
  roleTrack: string;
  roundType: string;
  difficulty: string;
  turns: ReportTurn[];
}): string {
  const transcript = args.turns
    .map((t) => {
      const line = `${t.speaker === "ai" ? "INTERVIEWER" : "CANDIDATE"}: ${t.text}`;
      return t.eval
        ? `${line}\n[private per-answer eval: score ${t.eval.score}/10 — ${t.eval.note}]`
        : line;
    })
    .join("\n\n");

  return `You are a senior hiring-committee reviewer writing a candid, constructive report card for a mock interview.

Interview: ${args.roleTrack} — ${args.roundType} round — ${args.difficulty} difficulty.

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
