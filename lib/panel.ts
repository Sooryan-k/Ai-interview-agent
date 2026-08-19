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

/**
 * The interviewer personas this app creates, so the avatar matches the name
 * rather than guessing. Everything else falls through to the male face.
 * The first three are the panel personas; the rest are the solo interviewer
 * pool. A few extra common names are listed so an avatar still lands
 * correctly if the model ever strays from the roster.
 */
const FEMALE_PERSONAS = new Set([
  "priya",
  "meera",
  "ananya",
  "divya",
  "kavya",
  "aditi",
  "sneha",
  "anjali",
  "neha",
  "pooja",
  "riya",
  "shreya",
]);

export function panelistEmoji(name: string): string {
  return FEMALE_PERSONAS.has(name.trim().toLowerCase()) ? "👩" : "👨";
}
