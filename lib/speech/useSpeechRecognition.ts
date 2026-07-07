"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

const FILLER_WORDS = [
  "um",
  "uh",
  "erm",
  "hmm",
  "like",
  "you know",
  "basically",
  "actually",
  "sort of",
  "kind of",
];

export interface SpeechMetrics {
  fillers: number;
  wpm: number;
  long_pauses: number;
  duration_s: number;
}

export function countFillers(text: string): number {
  const lower = ` ${text.toLowerCase()} `;
  let count = 0;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "g");
    count += (lower.match(re) ?? []).length;
  }
  return count;
}

export function useSpeechRecognition(lang = "en-US") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<(text: string) => void>(() => {});
  const sessionStartRef = useRef<number>(0);
  const lastResultAtRef = useRef<number>(0);
  const pausesRef = useRef<number>(0);
  const wordsRef = useRef<number>(0);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition ||
      w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      const now = Date.now();
      if (lastResultAtRef.current && now - lastResultAtRef.current > 2500) {
        pausesRef.current += 1;
      }
      lastResultAtRef.current = now;

      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) {
            wordsRef.current += text.split(/\s+/).length;
            onFinalRef.current(text);
          }
        } else {
          interimText += r[0].transcript;
        }
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.onerror = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    };
  }, [lang]);

  const start = useCallback((onFinal: (text: string) => void) => {
    const rec = recognitionRef.current;
    if (!rec) return;
    onFinalRef.current = onFinal;
    sessionStartRef.current = Date.now();
    lastResultAtRef.current = 0;
    pausesRef.current = 0;
    wordsRef.current = 0;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback((): SpeechMetrics => {
    const rec = recognitionRef.current;
    try {
      rec?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    const durationS = sessionStartRef.current
      ? (Date.now() - sessionStartRef.current) / 1000
      : 0;
    const wpm =
      durationS > 5 ? Math.round((wordsRef.current / durationS) * 60) : 0;
    return {
      fillers: 0, // fillers are counted on the composed text at submit time
      wpm,
      long_pauses: pausesRef.current,
      duration_s: Math.round(durationS),
    };
  }, []);

  return { supported, listening, interim, start, stop };
}
