"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

interface ResumeStruct {
  summary: string;
  years_experience: number;
  skills: string[];
  highlights: string[];
  gaps: string[];
}
interface Roast {
  roast_md: string;
  fixes: string[];
}

/** Extracts PDF text fully in-browser (pdfjs), then sends only text to the API. */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Bundler emits the worker; keeps everything offline/CSP-safe.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  return text.trim();
}

export function ResumeUpload({
  initialStruct,
  hasResume,
}: {
  initialStruct: ResumeStruct | null;
  hasResume: boolean;
}) {
  const [struct, setStruct] = useState<ResumeStruct | null>(initialStruct);
  const [busy, setBusy] = useState(false);
  const [roasting, setRoasting] = useState(false);
  const [roast, setRoast] = useState<Roast | null>(null);
  const [lastText, setLastText] = useState<string | null>(null);

  async function onFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF.");
      return;
    }
    setBusy(true);
    setRoast(null);
    try {
      const text = await extractPdfText(file);
      if (text.length < 100) {
        toast.error(
          "Couldn't read much text — is it a scanned image? Try a text-based PDF."
        );
        return;
      }
      setLastText(text);
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok) {
        setStruct(data.struct);
        toast.success("Resume analyzed — interviews will now probe your skills.");
      } else {
        toast.error(data.message || "Couldn't analyze the resume — try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read that PDF. Try a different file.");
    } finally {
      setBusy(false);
    }
  }

  async function doRoast() {
    setRoasting(true);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastText ? { text: lastText } : {}),
      });
      const data = await res.json();
      if (res.ok) {
        setRoast(data.roast);
      } else {
        toast.error(data.message || "Couldn't roast right now — try later.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setRoasting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resume</CardTitle>
        <CardDescription>
          Upload your resume (PDF). It&apos;s read in your browser — only the
          text is sent. The interviewer then tailors questions to your
          background and probes what you claim.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              disabled={busy}
            />
            <span className="inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm hover:bg-muted">
              {busy
                ? "Reading…"
                : hasResume || struct
                  ? "Replace resume PDF"
                  : "Upload resume PDF"}
            </span>
          </label>
          {(struct || hasResume) && (
            <Button
              size="sm"
              variant="outline"
              onClick={doRoast}
              disabled={roasting}
            >
              {roasting ? (
                "Roasting…"
              ) : (
                <>
                  <Flame data-icon="inline-start" /> Roast my resume
                </>
              )}
            </Button>
          )}
        </div>

        {struct && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm">{struct.summary}</p>
            {struct.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {struct.skills.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
            {struct.gaps.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Likely interview probes:
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {struct.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {roast && (
          <div className="space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
            <p className="whitespace-pre-wrap text-sm">{roast.roast_md}</p>
            {roast.fixes.length > 0 && (
              <div>
                <p className="text-xs font-medium">Actually useful fixes:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                  {roast.fixes.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
