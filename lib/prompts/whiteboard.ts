export function whiteboardPrompt(question: string): string {
  return `You are a staff engineer grading a candidate's system-design whiteboard for this prompt:

"${question}"

The attached image is the candidate's architecture diagram. Read it carefully — boxes, arrows, labels, data stores, and any text. Grade it as you would in a real interview.

Output STRICT JSON only:
{
  "overall_score": number,          // 0-100. 50 = passable, 70 = solid, 85+ = strong hire signal
  "components_identified": string[], // the components/services you can see in the diagram
  "strengths": string[],            // 2-4 things done well, referencing what's actually drawn
  "bottlenecks": string[],          // 2-4 scaling/reliability bottlenecks in THIS design
  "missing_pieces": string[],       // 2-4 components a strong design would add (cache, LB, queue, replica, CDN, etc.) that are absent
  "follow_up_questions": string[],  // 2-3 questions a real interviewer would ask about this diagram
  "verdict": string                 // 1-2 sentence summary
}

Rules: judge only what's in the image. If the diagram is nearly empty or illegible, say so honestly and score low. JSON only.`;
}
