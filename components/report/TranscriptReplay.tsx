"use client";

import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripAnswerMarkers } from "@/lib/schemas";
import { splitSpeakerTag } from "@/lib/panel";

/**
 * Re-speaks the interview transcript via the browser TTS (zero cost).
 * Uses the speechSynthesis API directly so each line's onend cleanly drives
 * the next (avoids stale-closure polling of a hook's state).
 */
export function TranscriptReplay({
  turns,
}: {
  turns: { speaker: string; text: string }[];
}) {
  const [supported, setSupported] = useState(false);
  const [playing, setPlaying] = useState(false);
  const idxRef = useRef(0);

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

  function speakFrom(i: number) {
    if (i >= turns.length) {
      setPlaying(false);
      return;
    }
    idxRef.current = i;
    const t = turns[i];
    // Panel transcripts carry a "[Priya]" speaker tag — announce the name
    // instead of spelling the brackets out.
    const { speaker, body } = splitSpeakerTag(stripAnswerMarkers(t.text));
    const prefix =
      t.speaker !== "ai"
        ? "You answered. "
        : speaker
          ? `${speaker} says. `
          : "Interviewer says. ";
    const u = new SpeechSynthesisUtterance(prefix + body);
    u.rate = 1.0;
    u.onend = () => {
      // Only advance if we weren't stopped.
      if (playingRef.current) speakFrom(i + 1);
    };
    u.onerror = () => {
      if (playingRef.current) speakFrom(i + 1);
    };
    window.speechSynthesis.speak(u);
  }

  const playingRef = useRef(false);

  function play() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    playingRef.current = true;
    setPlaying(true);
    speakFrom(0);
  }

  function stop() {
    playingRef.current = false;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  if (!supported) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={playing ? stop : play}
      className="print-hidden"
    >
      {playing ? (
        <>
          <Square data-icon="inline-start" /> Stop replay
        </>
      ) : (
        <>
          <Volume2 data-icon="inline-start" /> Play interview
        </>
      )}
    </Button>
  );
}
