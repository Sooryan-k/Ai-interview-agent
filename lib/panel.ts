/**
 * Panel rounds prefix every interviewer message with the speaker in brackets
 * ("[Priya] So, tell me…"). That prefix is addressing metadata, not speech:
 * the UI lifts it out into a labelled avatar beside the bubble, and it must
 * never be read aloud.
 */

/** A complete tag at the start of a message: "[Priya] ". */
const SPEAKER_TAG = /^\s*\[([A-Za-z][A-Za-z0-9 .'’-]{0,30})\]\s*/;

/**
 * A complete OR still-arriving tag. Used while streaming so a half-received
 * "[Pri" never flashes on screen or gets spoken, and so stripping stays
 * stable as the rest of the tag arrives.
 */
const PARTIAL_SPEAKER_TAG = /^\s*\[[^\]\n]{0,31}\]?\s*/;

export interface SpokenLine {
  /** Panelist name, or null for a normal single-interviewer message. */
  speaker: string | null;
  /** The message with any speaker tag removed. */
  body: string;
}

export function splitSpeakerTag(text: string): SpokenLine {
  const m = text.match(SPEAKER_TAG);
  if (!m) return { speaker: null, body: text };
  return { speaker: m[1].trim(), body: text.slice(m[0].length) };
}

/** Panel rounds only — solo messages can legitimately start with a bracket. */
export function stripSpeakerTag(text: string, isPanel: boolean): string {
  return isPanel ? text.replace(PARTIAL_SPEAKER_TAG, "") : text;
}

// People, not role objects — an avatar should look like a person. The three
// personas the panel prompt defines get a fixed face each; Dana is a unisex
// name, so it takes the third distinct face rather than implying anything.
const KNOWN: Record<string, string> = {
  priya: "👩",
  marcus: "👨",
  dana: "🧔",
};

// Fallback pool, in case the model invents a name. Deterministic per name so a
// panelist keeps the same face for the whole interview.
const POOL = ["👩", "👨", "🧔"];

export function panelistEmoji(name: string): string {
  const key = name.trim().toLowerCase();
  if (KNOWN[key]) return KNOWN[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return POOL[Math.abs(hash) % POOL.length];
}
