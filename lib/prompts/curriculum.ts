export function curriculumPrompt(stackLabel: string): string {
  return `You are an expert engineering-interview coach and curriculum designer.
Create a complete interview-preparation curriculum for the technology stack: "${stackLabel}".

The curriculum must take a learner from complete scratch to expert, interview-ready level.

Output STRICT JSON only, matching exactly this TypeScript shape:
{
  "stack_label": string,
  "levels": [
    {
      "key": string,            // kebab-case slug
      "title": string,
      "summary": string,        // one sentence
      "modules": [
        {
          "key": string,        // kebab-case slug, unique across the whole curriculum
          "title": string,
          "topics": [
            {
              "key": string,    // kebab-case slug, unique across the whole curriculum
              "title": string,
              "objective": string,   // ability the learner must demonstrate in an interview
              "est_minutes": number
            }
          ]
        }
      ]
    }
  ]
}

Requirements:
- Exactly 4 or 5 levels, in this order: Foundations, Intermediate, Advanced, Expert, and optionally a final "Interview-Ready" level focused on mock-drill topics (system design prompts, behavioral frameworks, whiteboard practice).
- 1-3 modules per level; 3-6 topics per module.
- Topics must be interview-oriented: phrase every objective as an ability ("Explain...", "Design...", "Debug...", "Compare...").
- Cover the full stack and its ecosystem: language fundamentals, frameworks, tooling, testing, performance, security basics, and system design at the higher levels.
- All keys must be unique kebab-case slugs.
- No markdown, no commentary — output the JSON object only.`;
}
