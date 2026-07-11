"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Share-link management + print/PDF. Zero AI cost. */
export function ReportActions({
  interviewId,
  initialSlug,
}: {
  interviewId: string;
  initialSlug: string | null;
}) {
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [busy, setBusy] = useState(false);

  const shareUrl = slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${slug}`
    : null;

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(`/api/report/${interviewId}/share`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.slug) {
        toast.error("Couldn't create the link — try again.");
        return;
      }
      setSlug(data.slug);
      await navigator.clipboard
        .writeText(`${window.location.origin}/r/${data.slug}`)
        .catch(() => {});
      toast.success("Public link copied to clipboard");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    toast.success("Link copied");
  }

  async function unshare() {
    setBusy(true);
    try {
      const res = await fetch(`/api/report/${interviewId}/share`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSlug(null);
        toast.success("Link disabled — the report is private again");
      } else {
        toast.error("Couldn't disable the link.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="print-hidden flex flex-wrap items-center gap-2">
      {slug ? (
        <>
          <Button size="sm" variant="outline" onClick={copyLink}>
            🔗 Copy public link
          </Button>
          <Button size="sm" variant="ghost" onClick={unshare} disabled={busy}>
            Make private
          </Button>
        </>
      ) : (
        <Button size="sm" variant="outline" onClick={share} disabled={busy}>
          {busy ? "Creating link…" : "🔗 Share report"}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        🖨 Save as PDF
      </Button>
    </div>
  );
}
