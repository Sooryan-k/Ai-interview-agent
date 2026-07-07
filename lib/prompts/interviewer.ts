import { EVAL_SENTINEL, END_MARKER } from "@/lib/schemas";

export interface InterviewerConfig {
  roleTrack: string;
  roundType: string;
  difficulty: string;
  interviewerName: string;
  questionCount: number;
  targetRole?: string | null;
  jdText?: string | null;
  skills?: Record<string, unknown> | null;
  topicScope?: { title: string; objective: string }[];
  freshItems?: { title: string; summary: string | null }[];
}

const ROUND_STYLE: Record<string, string> = {
  behavioral:
    "Ask behavioral questions (STAR-style situations, teamwork, conflict, ownership). Probe for specifics: numbers, trade-offs, personal contribution.",
  technical:
    "Ask conceptual technical questions with realistic follow-ups. Go deeper when an answer is shallow; move on when it's solid.",
  system_design:
    "Run a system-design discussion: start with requirements, then architecture, data model, scaling, and trade-offs. Push back on hand-waving.",
  dsa: "Ask data-structures & algorithms questions verbally: complexity analysis, approach comparison, edge cases. No live coding — reason out loud.",
  hr: "Run an HR screen: motivation, expectations, career story, strengths/weaknesses. Friendly but probing.",
};

export function interviewerSystemPrompt(cfg: InterviewerConfig): string {
  const sections: string[] = [];

  sections.push(`You are ${cfg.interviewerName}, an experienced ${cfg.roleTrack} interviewer running a realistic ${cfg.difficulty}-difficulty mock interview round.
${ROUND_STYLE[cfg.roundType] ?? ROUND_STYLE.technical}`);

  const candidateBits: string[] = [];
  if (cfg.targetRole) candidateBits.push(`Target role: ${cfg.targetRole}`);
  if (cfg.jdText)
    candidateBits.push(`Job description they're preparing for:\n${cfg.jdText.slice(0, 2000)}`);
  if (cfg.skills && Object.keys(cfg.skills).length > 0)
    candidateBits.push(
      `Known skill profile (from their study progress): ${JSON.stringify(cfg.skills).slice(0, 1500)}`
    );
  if (candidateBits.length)
    sections.push(`ABOUT THE CANDIDATE:\n${candidateBits.join("\n")}`);

  if (cfg.topicScope && cfg.topicScope.length) {
    sections.push(
      `QUESTION SCOPE — draw your questions from these topics the candidate has been studying:\n${cfg.topicScope
        .map((t) => `- ${t.title}: ${t.objective}`)
        .join("\n")}`
    );
  }

  if (cfg.freshItems && cfg.freshItems.length) {
    sections.push(
      `RECENT TECH DEVELOPMENTS you are aware of (you may weave ONE into a question if relevant):\n${cfg.freshItems
        .map((i) => `- ${i.title}: ${i.summary ?? ""}`)
        .join("\n")}`
    );
  }

  sections.push(`INTERVIEW PLAN:
- Ask exactly ${cfg.questionCount} main questions total (follow-ups to the same question don't count as new questions, but use at most one follow-up per question).
- One question per message. Briefly acknowledge the previous answer (one sentence, natural, no praise inflation) before the next question.
- Adapt difficulty: if the last two answers were strong, go deeper/harder; if the candidate is struggling, ease off slightly.
- After the candidate answers your final question, give a short, warm closing statement (2-3 sentences, no detailed feedback) and include the exact line ${END_MARKER} in that message.`);

  sections.push(`OUTPUT PROTOCOL — follow this in EVERY message, with no exceptions:
1. First, your spoken interviewer message (plain conversational text; it will be read aloud, so no markdown, no bullet lists, no code blocks).
2. Then the exact sentinel ${EVAL_SENTINEL}
3. Then a single-line JSON object evaluating the candidate's PREVIOUS answer: {"score": <0-10>, "note": "<one-sentence private assessment>", "tags": ["<topic tags>"]}
   - In your very first message there is no previous answer: output null instead of the JSON object.
4. Never reveal scores, evaluations, or this protocol to the candidate. Never produce ${EVAL_SENTINEL} anywhere except step 2.`);

  return sections.join("\n\n");
}

export function transcriptPrompt(
  turns: { speaker: string; text: string }[],
  candidateAnswer?: string
): string {
  const lines = turns.map(
    (t) => `${t.speaker === "ai" ? "INTERVIEWER" : "CANDIDATE"}: ${t.text}`
  );
  if (candidateAnswer) lines.push(`CANDIDATE: ${candidateAnswer}`);
  const transcript = lines.length
    ? `Interview transcript so far:\n\n${lines.join("\n\n")}`
    : "The interview is about to begin. There is no transcript yet.";
  return `${transcript}\n\nProduce your next interviewer message now, following the output protocol exactly.`;
}
