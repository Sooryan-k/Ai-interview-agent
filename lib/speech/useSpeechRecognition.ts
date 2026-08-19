"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clarityScore } from "@/lib/speech/delivery";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string; confidence?: number };
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

export interface SpeechMetrics {
  fillers: number;
  /** Weak-commitment phrases ("I think maybe…"). Counted at submit time. */
  hedges: number;
  wpm: number;
  long_pauses: number;
  duration_s: number;
  /** 0-100 recognition confidence, or null when the browser reports none. */
  clarity: number | null;
}

// Re-exported so existing callers keep importing from the hook they already use.
export { countFillers, countHedges } from "@/lib/speech/delivery";

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
  const confidencesRef = useRef<number[]>([]);

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
            const conf = r[0].confidence;
            if (typeof conf === "number" && conf > 0) {
              confidencesRef.current.push(conf);
            }
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
    confidencesRef.current = [];
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
      // fillers/hedges are counted on the composed text at submit time
      fillers: 0,
      hedges: 0,
      wpm,
      long_pauses: pausesRef.current,
      duration_s: Math.round(durationS),
      clarity: clarityScore(confidencesRef.current),
    };
  }, []);

  return { supported, listening, interim, start, stop };
}
