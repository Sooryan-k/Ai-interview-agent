"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Text-to-speech built on the free browser speechSynthesis API.
 * `speak` enqueues a sentence; the browser plays utterances in order.
 *
 * Voice quality: the browser default is often a robotic, unpleasant voice.
 * We rank the installed voices and pick the most natural one available
 * (cloud "Google" voices, OS "Natural"/premium voices, then good local ones),
 * and use a calm rate/pitch so the interviewer sounds human, not creepy.
 */

/** Higher score = more natural / preferred. */
function scoreVoice(v: SpeechSynthesisVoice, lang: string): number {
  const name = v.name.toLowerCase();
  const langMatch = v.lang.toLowerCase().startsWith(lang.slice(0, 2));
  if (!langMatch) return -1;

  let score = 0;
  if (v.lang.toLowerCase() === lang.toLowerCase()) score += 3; // exact locale
  // Cloud / neural voices — the good ones.
  if (name.includes("google")) score += 10;
  if (name.includes("natural")) score += 10;
  if (name.includes("neural")) score += 9;
  if (name.includes("premium") || name.includes("enhanced")) score += 6;
  // Known-good macOS/iOS voices.
  if (/(samantha|allison|ava|zoe|serena|karen|daniel|aaron|nicky|evan)/.test(name))
    score += 5;
  // Avoid the notoriously robotic/novelty macOS voices.
  if (/(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy)/.test(name))
    score -= 20;
  // Prefer non-local (cloud) voices slightly — usually higher quality.
  if (!v.localService) score += 2;
  return score;
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  lang: string
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const s = scoreVoice(v, lang);
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
  const enabledRef = useRef(true);
  const pendingRef = useRef(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;

    // Voices load asynchronously; (re)select whenever the list changes.
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const best = pickBestVoice(voices, lang);
      if (best) voiceRef.current = best;
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [lang]);

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
      // Calm, human cadence — a touch slower than default, neutral pitch.
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      pendingRef.current += 1;
      setSpeaking(true);
      const done = () => {
        pendingRef.current = Math.max(0, pendingRef.current - 1);
        if (pendingRef.current === 0) setSpeaking(false);
      };
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    },
    [lang]
  );

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    pendingRef.current = 0;
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

  return { supported, enabled, speaking, speak, cancel, toggle };
}
