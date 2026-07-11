export function bankPrompt(args: {
  roleTrack: string;
  roundType: string;
  difficulty: string;
}): string {
  return `You are curating a question bank for an interview-preparation app.

Role track: ${args.roleTrack}
Round type: ${args.roundType}
Difficulty: ${args.difficulty}

Write 12 distinct, realistic interview questions actually asked in ${args.roundType} rounds for ${args.roleTrack} candidates at ${args.difficulty} level. Mix classic staples with less-common but high-signal questions.

Output STRICT JSON only:
{
  "questions": [
    {
      "question": string,          // the question, as an interviewer would say it
      "ideal_points": string[],    // 2-4 bullets a strong answer must hit
      "tags": string[]             // 1-3 lowercase skill tags, e.g. ["react","state-management"]
    }
  ]
}

Rules: no duplicates or trivial rephrasings; ideal_points must be specific (not "explains well"); JSON only.`;
}
