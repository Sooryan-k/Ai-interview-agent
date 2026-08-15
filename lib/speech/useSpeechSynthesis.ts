"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Text-to-speech built on the free browser speechSynthesis API.
 * `speak` enqueues a sentence; the browser plays utterances in order.
 *
 * Voice quality: the browser default is often a robotic, unpleasant voice.
 * We rank the installed voices and pick the most natural one for the chosen
 * gender (cloud "Google" voices, OS "Natural"/premium voices, then good local
 * ones), and use a calm rate/pitch so the interviewer sounds human.
 *
 * The Web Speech API doesn't expose a voice's gender, so we infer it from the
 * voice name ("...Male"/"...Female" labels and known male/female voice names).
 */

export type VoiceGender = "female" | "male";
const GENDER_STORAGE_KEY = "dryrun-ai:voiceGender";

const FEMALE_NAMES =
  /(samantha|victoria|allison|ava|susan|karen|moira|tessa|fiona|serena|zoe|nicky|kate|veena|amelie|anna|ellen|joana|luciana|paulina|alice|sara|nora)/;
const MALE_NAMES =
  /(daniel|alex|fred|oliver|thomas|aaron|arthur|gordon|evan|reed|rishi|xander|carlos|diego|jorge|juan|luca|otoya|yannick|nathan|tom)/;

/** Infer a voice's gender from its name, or null if unknown. */
function genderOf(v: SpeechSynthesisVoice): VoiceGender | null {
  const n = v.name.toLowerCase();
  if (n.includes("female")) return "female"; // check first — "male" ⊂ "female"
  if (n.includes("male")) return "male";
  if (FEMALE_NAMES.test(n)) return "female";
  if (MALE_NAMES.test(n)) return "male";
  return null;
}

/** Higher score = more natural / preferred, biased toward the wanted gender. */
function scoreVoice(
  v: SpeechSynthesisVoice,
  lang: string,
  wantGender: VoiceGender
): number {
  const name = v.name.toLowerCase();
  const langMatch = v.lang.toLowerCase().startsWith(lang.slice(0, 2));
  if (!langMatch) return -Infinity;

  let score = 0;
  if (v.lang.toLowerCase() === lang.toLowerCase()) score += 3; // exact locale

  // Gender match dominates so the two modes sound clearly different.
  const g = genderOf(v);
  if (g === wantGender) score += 40;
  else if (g && g !== wantGender) score -= 40;

  // Cloud / neural voices — the good ones.
  if (name.includes("google")) score += 10;
  if (name.includes("natural")) score += 10;
  if (name.includes("neural")) score += 9;
  if (name.includes("premium") || name.includes("enhanced")) score += 6;
  // Known-good macOS/iOS voices.
  if (/(samantha|allison|ava|zoe|serena|karen|daniel|aaron|nicky|evan|tom)/.test(name))
    score += 5;
  // Avoid the notoriously robotic/novelty macOS voices.
  if (/(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|kathy)/.test(name))
    score -= 20;
  if (!v.localService) score += 2; // cloud usually higher quality
  return score;
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  wantGender: VoiceGender
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const s = scoreVoice(v, lang, wantGender);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

export function useSpeechSynthesis(lang = "en-US") {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [gender, setGenderState] = useState<VoiceGender>("female");
  const enabledRef = useRef(true);
  const pendingRef = useRef(0);
  const pendingTextsRef = useRef<string[]>([]); // queued/playing utterance text, in order
  const genRef = useRef(0); // bumped on any interruption, so stale onend/onerror callbacks no-op
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const genderRef = useRef<VoiceGender>("female");

  const reselect = useCallback(() => {
    const best = pickVoice(voicesRef.current, lang, genderRef.current);
    if (best) voiceRef.current = best;
  }, [lang]);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;

    // Restore the saved gender preference.
    const saved = window.localStorage.getItem(GENDER_STORAGE_KEY);
    if (saved === "male" || saved === "female") {
      genderRef.current = saved;
      setGenderState(saved);
    }

    // Voices load asynchronously; (re)select whenever the list changes.
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      reselect();
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [reselect]);

  const speak = useCallback(
    (text: string) => {
      if (!enabledRef.current) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;
      const clean = text.trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current?.lang ?? lang;
      // Calm, human cadence; nudge pitch by gender for a clearer distinction.
      utterance.rate = 0.95;
      utterance.pitch = genderRef.current === "male" ? 0.9 : 1.05;
      utterance.volume = 1.0;

      const myGen = genRef.current;
      pendingRef.current += 1;
      pendingTextsRef.current.push(clean);
      setSpeaking(true);
      const done = () => {
        if (myGen !== genRef.current) return; // superseded by an interruption below
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        const idx = pendingTextsRef.current.indexOf(clean);
        if (idx !== -1) pendingTextsRef.current.splice(idx, 1);
        if (pendingRef.current === 0) setSpeaking(false);
      };
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    },
    [lang]
  );

  const setGender = useCallback(
    (next: VoiceGender) => {
      genderRef.current = next;
      setGenderState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(GENDER_STORAGE_KEY, next);
      }
      reselect();

      // Whatever was queued/playing gets cut off by cancel() below — capture
      // it so we can replay it in the new voice instead of silently dropping
      // the rest of what the interviewer was saying.
      const interrupted = pendingTextsRef.current.slice();
      pendingTextsRef.current = [];
      pendingRef.current = 0;
      genRef.current += 1; // invalidate in-flight onend/onerror from the old voice
      setSpeaking(false);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (interrupted.length) {
        // A couple of browsers drop a speak() called in the same tick as
        // cancel(); a tiny delay makes the resume reliable.
        setTimeout(() => interrupted.forEach((text) => speak(text)), 50);
      }
    },
    [reselect, speak]
  );

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    pendingTextsRef.current = [];
    pendingRef.current = 0;
    genRef.current += 1;
    setSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      enabledRef.current = next;
      if (!next) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        pendingRef.current = 0;
        setSpeaking(false);
      }
      return next;
    });
  }, []);

  return {
    supported,
    enabled,
    speaking,
    gender,
    setGender,
    speak,
    cancel,
    toggle,
  };
}
