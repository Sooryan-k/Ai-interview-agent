export function storyPolishPrompt(args: {
  title: string;
  raw: string;
}): string {
  return `You are a behavioral-interview coach. A candidate has drafted a story about a real experience. Rewrite it into a tight, compelling STAR-format answer they can deliver out loud in ~90 seconds.

Title: ${args.title}
Their draft:
${args.raw.slice(0, 2500)}

Output STRICT JSON only:
{
  "polished_md": string,   // markdown: **Situation** / **Task** / **Action** / **Result** sections, concise and specific. Keep THEIR facts — do not invent achievements or numbers. If a metric is missing, add a bracketed placeholder like "[quantify: e.g. reduced load time by X%]".
  "tags": string[]         // 1-3 lowercase themes, e.g. ["leadership","conflict","ownership"]
}

Rules: preserve the candidate's real details; tighten wording; make the Result land. JSON only.`;
}
