"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Footprints,
  Lightbulb,
  Mic,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useSpeechRecognition,
  countFillers,
  type SpeechMetrics,
} from "@/lib/speech/useSpeechRecognition";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { END_MARKER } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Turn {
  speaker: "ai" | "user";
  text: string;
}

type Phase =
  | "connecting"
  | "ready"
  | "streaming"
  | "ended"
  | "quota"
  | "error";

export function InterviewRoom({
  interviewId,
  initialTurns,
  initialStatus,
  interviewerName,
  roleTrack,
  roundType,
  difficulty,
  questionCount,
  currency,
}: {
  interviewId: string;
  initialTurns: Turn[];
  initialStatus: string;
  interviewerName: string;
  roleTrack: string;
  roundType: string;
  difficulty: string;
  questionCount: number;
  currency?: string;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [streaming, setStreaming] = useState("");
  const [phase, setPhase] = useState<Phase>(
    initialStatus === "complete" ? "ended" : "connecting"
  );
  const [composer, setComposer] = useState("");
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const [walkMode, setWalkMode] = useState(false);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<SpeechMetrics | null>(null);
  const spokenUpToRef = useRef(0);
  const autoMicForRef = useRef(-1);

  const recognition = useSpeechRecognition();
  const tts = useSpeechSynthesis();
  const { speak } = tts;

  const aiTurnCount =
    turns.filter((t) => t.speaker === "ai").length +
    (phase === "streaming" ? 1 : 0);

  // ---- streaming a turn from the server ----
  const speakNewSentences = useCallback(
    (text: string, flush: boolean) => {
      const clean = text.replace(END_MARKER, "");
      const pending = clean.slice(spokenUpToRef.current);
      if (flush) {
        if (pending.trim()) speak(pending);
        spokenUpToRef.current = clean.length;
        return;
      }
      // Speak completed sentences as they arrive.
      const match = pending.match(/^[\s\S]*[.!?](?=\s|$)/);
      if (match && match[0].trim()) {
        speak(match[0]);
        spokenUpToRef.current += match[0].length;
      }
    },
    [speak]
  );

  const requestTurn = useCallback(
    async (
      answer: string | null,
      metrics: SpeechMetrics | null,
      hint = false
    ) => {
      setPhase("streaming");
      setStreaming("");
      spokenUpToRef.current = 0;

      let res: Response;
      try {
        res = await fetch(`/api/interview/${interviewId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: answer ?? undefined,
            speechMetrics: metrics ?? undefined,
            hint: hint || undefined,
          }),
        });
      } catch {
        setPhase("error");
        toast.error("Network error — use “Nudge interviewer” to retry.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          if (data.error === "rate_limit") {
            const wait = Number(data.retryAfter) || 30;
            setCountdown(wait);
            setPhase("ready");
            toast.info(`The interviewer is busy — retry in ${wait}s.`);
            const timer = setInterval(() => {
              setCountdown((c) => {
                if (c <= 1) clearInterval(timer);
                return Math.max(0, c - 1);
              });
            }, 1000);
          } else {
            setQuotaMsg(
              data.message || "Daily AI budget reached — resume tomorrow."
            );
            setPhase("quota");
          }
          return;
        }
        setPhase("error");
        toast.error("Something went wrong — try nudging the interviewer.");
        return;
      }

      if (!res.body) {
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setStreaming(full.replace(END_MARKER, ""));
          speakNewSentences(full, false);
        }
      } catch {
        /* stream interrupted; fall through with what we have */
      }
      speakNewSentences(full, true);

      const ended = full.includes(END_MARKER);
      const visible = full.replace(END_MARKER, "").trim();
      if (visible) {
        setTurns((prev) => [...prev, { speaker: "ai", text: visible }]);
      }
      setStreaming("");
      setPhase(ended ? "ended" : "ready");
    },
    [interviewId, speakNewSentences]
  );

  // Kick off the opening question exactly once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialStatus === "complete") return;
    if (initialTurns.length === 0) {
      void requestTurn(null, null);
    } else if (initialTurns[initialTurns.length - 1].speaker === "user") {
      // An AI reply was lost previously — nudge to regenerate it.
      void requestTurn(null, null);
    } else {
      setPhase("ready");
    }
  }, [initialStatus, initialTurns, requestTurn]);

  // Auto-scroll transcript.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, streaming]);

  // Walk mode: after the interviewer finishes speaking, auto-start the mic
  // (hands-free, once per AI turn).
  const startListening = recognition.start;
  useEffect(() => {
    if (!walkMode || !recognition.supported) return;
    if (phase !== "ready" || tts.speaking || recognition.listening) return;
    if (turns.length === 0 || turns[turns.length - 1].speaker !== "ai") return;
    if (autoMicForRef.current === turns.length) return;
    autoMicForRef.current = turns.length;
    tts.cancel();
    startListening((finalText) =>
      setComposer((prev) => (prev ? `${prev} ${finalText}` : finalText))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkMode, phase, tts.speaking, recognition.listening, turns.length]);

  // Walk mode: auto-submit after ~4s of silence once something's been said.
  useEffect(() => {
    if (!walkMode || !recognition.listening || !composer.trim()) return;
    const id = setTimeout(() => submit(), 4000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkMode, recognition.listening, composer]);

  // ---- composer / voice ----
  function toggleMic() {
    if (recognition.listening) {
      metricsRef.current = recognition.stop();
    } else {
      tts.cancel(); // don't transcribe the interviewer's own voice
      recognition.start((finalText) => {
        setComposer((prev) => (prev ? `${prev} ${finalText}` : finalText));
      });
    }
  }

  function submit() {
    const text = composer.trim();
    if (!text || phase !== "ready" || countdown > 0) return;
    let metrics = metricsRef.current;
    if (recognition.listening) metrics = recognition.stop();
    if (metrics) metrics = { ...metrics, fillers: countFillers(text) };
    metricsRef.current = null;
    setComposer("");
    setTurns((prev) => [...prev, { speaker: "user", text }]);
    void requestTurn(text, metrics);
  }

  async function finish() {
    setFinishing(true);
    try {
      const res = await fetch(`/api/interview/${interviewId}/finish`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          data.message || "Couldn't build the report — try again in a minute."
        );
        setFinishing(false);
        return;
      }
      router.push(`/report/${interviewId}`);
    } catch {
      toast.error("Network error — try again.");
      setFinishing(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Status bar */}
      <div className="border-b bg-muted/30">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-4 sm:px-6 py-2 text-sm">
          <span className="font-medium">{interviewerName}</span>
          <span className="text-muted-foreground">· {roleTrack}</span>
          <Badge variant="outline">{roundType.replace("_", " ")}</Badge>
          <Badge variant="outline">{difficulty}</Badge>
          {currency && <Badge variant="outline">{currency}</Badge>}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              Q {Math.min(aiTurnCount, questionCount)}/{questionCount}
            </span>
            {tts.supported && (
              <>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button size="sm" variant="ghost" onClick={tts.toggle}>
                        {tts.enabled ? <Volume2 /> : <VolumeX />}
                        <span className="hidden sm:inline">
                          {tts.enabled ? "Voice on" : "Voice off"}
                        </span>
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {tts.enabled
                      ? "Mute the interviewer's voice"
                      : "Unmute — hear the interviewer speak"}
                  </TooltipContent>
                </Tooltip>
                {tts.enabled && (
                  <span className="flex overflow-hidden rounded-md border text-xs">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => tts.setGender("female")}
                            className={cn(
                              "px-2 py-1 transition-colors",
                              tts.gender === "female"
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            )}
                          >
                            F
                          </button>
                        }
                      />
                      <TooltipContent>Female interviewer voice</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => tts.setGender("male")}
                            className={cn(
                              "px-2 py-1 transition-colors",
                              tts.gender === "male"
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            )}
                          >
                            M
                          </button>
                        }
                      />
                      <TooltipContent>Male interviewer voice</TooltipContent>
                    </Tooltip>
                  </span>
                )}
              </>
            )}
            {recognition.supported && tts.supported && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      variant={walkMode ? "default" : "ghost"}
                      onClick={() => setWalkMode((w) => !w)}
                    >
                      <Footprints />
                      <span className="hidden sm:inline">
                        {walkMode ? "Walk on" : "Walk mode"}
                      </span>
                    </Button>
                  }
                />
                <TooltipContent>
                  Hands-free: the interviewer speaks, then auto-listens for
                  your answer
                </TooltipContent>
              </Tooltip>
            )}
            {phase !== "ended" && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={finish}
                      disabled={finishing || turns.length < 2}
                    >
                      End early
                    </Button>
                  }
                />
                <TooltipContent>
                  Wrap up now and get your report card from what you&apos;ve
                  answered so far
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 sm:px-6 py-6">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                t.speaker === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  t.speaker === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {t.text}
              </div>
            </div>
          ))}
          {phase === "streaming" && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">
                {streaming || (
                  <span className="animate-pulse text-muted-foreground">
                    {interviewerName} is thinking…
                  </span>
                )}
              </div>
            </div>
          )}
          {phase === "connecting" && turns.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">
              Connecting you with {interviewerName}…
            </p>
          )}
        </div>
      </div>

      {/* Footer: composer / end states */}
      <div className="border-t">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-4">
          {phase === "ended" ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">
                Interview complete. Great work — let&apos;s see how you did.
              </p>
              <Button onClick={finish} disabled={finishing} size="lg">
                {finishing ? "Compiling your report…" : "Get my report card →"}
              </Button>
            </div>
          ) : phase === "quota" ? (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {quotaMsg}
            </div>
          ) : (
            <div className="space-y-2">
              {recognition.interim && (
                <p className="text-xs italic text-muted-foreground">
                  {recognition.interim}
                </p>
              )}
              {turns.length > 0 &&
                turns[turns.length - 1].speaker === "ai" && (
                  <div className="flex justify-end">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => requestTurn(null, null, true)}
                            disabled={phase !== "ready" || countdown > 0}
                            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Lightbulb className="size-3.5" /> Rescue me
                              (hint)
                            </span>
                          </button>
                        }
                      />
                      <TooltipContent>
                        Stuck? Get a nudge without giving up
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              <div className="flex items-end gap-2">
                {recognition.supported && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant={
                            recognition.listening ? "destructive" : "outline"
                          }
                          onClick={toggleMic}
                          className="shrink-0"
                        >
                          {recognition.listening ? (
                            <>
                              <Square />{" "}
                              <span className="hidden sm:inline">Stop</span>
                            </>
                          ) : (
                            <>
                              <Mic />{" "}
                              <span className="hidden sm:inline">Speak</span>
                            </>
                          )}
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {recognition.listening
                        ? "Stop dictating"
                        : "Answer with your voice"}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Textarea
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={
                    recognition.listening
                      ? "Listening… speak your answer"
                      : "Type your answer (or use the mic) — Enter to send"
                  }
                  rows={1}
                  className="min-h-11 resize-none placeholder:text-xs sm:min-h-16 sm:placeholder:text-sm"
                  disabled={phase === "streaming" || phase === "connecting"}
                />
                <Button
                  onClick={submit}
                  disabled={
                    phase !== "ready" || !composer.trim() || countdown > 0
                  }
                  className="shrink-0"
                >
                  {countdown > 0 ? `Wait ${countdown}s` : "Send"}
                </Button>
              </div>
              {phase === "error" && (
                <div className="text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => requestTurn(null, null)}
                  >
                    Nudge interviewer (retry)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
