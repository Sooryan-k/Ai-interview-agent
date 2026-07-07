export function studyPrompt(args: {
  stackLabel: string;
  levelTitle: string;
  topicTitle: string;
  objective: string;
  freshItems?: { title: string; url: string; summary: string | null }[];
}): string {
  const fresh =
    args.freshItems && args.freshItems.length
      ? `\nRecent developments you may reference where relevant (include the best 1-2 in resources):\n${args.freshItems
          .map((i) => `- ${i.title} (${i.url}): ${i.summary ?? ""}`)
          .join("\n")}`
      : "";

  return `You are an expert engineering mentor writing interview-preparation study material.

Stack: ${args.stackLabel}
Level: ${args.levelTitle}
Topic: ${args.topicTitle}
Learning objective: ${args.objective}
${fresh}
Write focused study material that gets a candidate ready to discuss this topic in a technical interview.

Output STRICT JSON only, matching exactly:
{
  "content_md": string,           // 400-800 words of markdown: clear explanation, key concepts as a numbered list, 1-2 annotated code examples in fenced blocks, and a "Common pitfalls" section
  "cheat_sheet_md": string,       // 4-8 bullet lines: the compressed version to review right before an interview
  "resources": [{"title": string, "url": string}],   // 2-4 high-quality FREE resources (official docs, MDN, well-known free tutorials). Only well-known URLs you are confident exist.
  "interview_questions": string[] // 5 questions an interviewer would realistically ask on this topic, ordered easy to hard
}

Rules:
- Markdown only inside the strings; the outer envelope must be valid JSON (escape newlines as \\n).
- Explain the WHY behind every concept — interviewers probe reasoning, not recall.
- Code examples must be minimal and idiomatic for the stack.
- No commentary outside the JSON object.`;
}
