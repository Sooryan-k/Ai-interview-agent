export function codeReviewPrompt(args: {
  problem: string;
  language: string;
  source: string;
  testsPassed: number;
  testsTotal: number;
}): string {
  return `You are a senior engineer reviewing a candidate's solution in a coding interview.

Problem:
${args.problem}

Language: ${args.language}
Automated tests: ${args.testsPassed}/${args.testsTotal} passed.

Candidate's code:
\`\`\`
${args.source.slice(0, 6000)}
\`\`\`

Output STRICT JSON only:
{
  "overall_score": number,       // 0-100, weighing correctness most, then complexity, then style
  "correctness": string,         // 1-2 sentences on whether it's right and any edge cases missed
  "complexity": string,          // time & space complexity, and whether it's optimal
  "strengths": string[],         // 1-3 genuine strengths
  "improvements": string[],      // 2-4 concrete improvements
  "cleaner_approach": string     // 1-3 sentences describing a cleaner/optimal approach (no full code dump)
}

Rules: base the review on the actual code. If tests failed, correctness must reflect that. JSON only.`;
}
