export function resumePrompt(resumeText: string): string {
  return `Extract a structured profile from this resume text for an interview-prep app.

RESUME:
${resumeText.slice(0, 8000)}

Output STRICT JSON only:
{
  "summary": string,             // one-sentence positioning summary
  "years_experience": number,    // best estimate of total years, 0 if unclear
  "skills": string[],            // lowercase technologies/skills they credibly claim (max 15)
  "highlights": string[],        // 2-4 strongest, most quantified accomplishments
  "gaps": string[]               // 2-4 areas an interviewer will likely probe or that are missing for a strong candidate
}

Rules: only use what's in the resume; don't invent. JSON only.`;
}

export function roastPrompt(resumeText: string): string {
  return `You are a witty but genuinely helpful career coach doing a "resume roast" — funny, a little savage, but every joke lands on a real, fixable problem.

RESUME:
${resumeText.slice(0, 8000)}

Output STRICT JSON only:
{
  "roast_md": string,   // 2-4 short punchy paragraphs (markdown). Funny and shareable, PG-13, never mean about the person — roast the RESUME. Emojis ok in moderation.
  "fixes": string[]     // 3-5 concrete, specific improvements they can make today
}

Rules: base every joke on something actually in the resume. Be helpful under the humor. JSON only.`;
}
