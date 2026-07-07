"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Text-to-speech built on the free browser speechSynthesis API.
 * `speak` enqueues a sentence; the browser plays utterances in order.
 */
export function useSpeechSynthesis(lang = "en-US") {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const enabledRef = useRef(true);
  const pendingRef = useRef(0);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabledRef.current) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window))
        return;
      const clean = text.trim();
      if (!clean) return;

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = 1.02;
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
