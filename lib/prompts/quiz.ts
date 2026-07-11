export function quizPrompt(args: {
  stackLabel: string;
  moduleTitle: string;
  levelTitle: string;
  topics: { title: string; objective: string }[];
}): string {
  const topicList = args.topics
    .map((t) => `- ${t.title}: ${t.objective}`)
    .join("\n");

  return `You are writing a module checkpoint quiz for an interview-preparation app.

Stack: ${args.stackLabel}
Level: ${args.levelTitle}
Module: ${args.moduleTitle}
Topics covered:
${topicList}

Write a quiz with 6-8 questions covering these topics: mostly multiple-choice, plus 1-2 short-answer questions. Interview-calibrated: test understanding and the classic follow-ups, not trivia.

Output STRICT JSON only:
{
  "questions": [
    {
      "type": "mcq",
      "q": string,                    // the question
      "options": string[],            // 4 plausible options, one correct
      "answer": number,               // 0-based index of the correct option
      "explanation": string           // 1-2 sentences: why, and why the traps are wrong
    },
    {
      "type": "short",
      "q": string,                    // asks for a 1-3 sentence spoken-style answer
      "ideal_points": string[],       // 2-4 bullet points a great answer hits
      "explanation": string
    }
  ]
}

Rules: distractor options must be genuinely tempting misconceptions. Vary difficulty from warm-up to hard. JSON only, no commentary.`;
}
