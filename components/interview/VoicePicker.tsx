"use client";

import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { cn } from "@/lib/utils";

const SAMPLE_LINE =
  "Hi, I'm your interviewer today — let's get started whenever you're ready.";

/**
 * Interviewer voice (male/female) picker with a preview button, so the
 * choice is heard, not just labeled. Reads/writes the same localStorage
 * key useSpeechSynthesis persists everywhere else (InterviewRoom, Settings),
 * so setting it here carries over automatically — no shared state needed.
 */
export function VoicePicker({ className }: { className?: string }) {
  const tts = useSpeechSynthesis();
  const [previewing, setPreviewing] = useState(false);

  // The utterance ends on its own; sync the button label when it does.
  useEffect(() => {
    if (previewing && !tts.speaking) setPreviewing(false);
  }, [previewing, tts.speaking]);

  if (!tts.supported) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Voice preview isn&apos;t supported in this browser — Chrome or Edge
        work best. Typing always works during the interview.
      </p>
    );
  }

  function preview() {
    if (previewing) {
      tts.cancel();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    tts.speak(SAMPLE_LINE);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="flex overflow-hidden rounded-md border text-sm">
        <button
          type="button"
          onClick={() => tts.setGender("female")}
          className={cn(
            "px-3 py-1.5 transition-colors",
            tts.gender === "female"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
        >
          Female
        </button>
        <button
          type="button"
          onClick={() => tts.setGender("male")}
          className={cn(
            "px-3 py-1.5 transition-colors",
            tts.gender === "male"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
        >
          Male
        </button>
      </span>
      <Button type="button" size="sm" variant="outline" onClick={preview}>
        {previewing ? (
          <>
            <Square data-icon="inline-start" /> Stop
          </>
        ) : (
          <>
            <Play data-icon="inline-start" /> Preview voice
          </>
        )}
      </Button>
    </div>
  );
}
