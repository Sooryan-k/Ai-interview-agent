"use client";

import { useState } from "react";
import { toast } from "sonner";

/** Enrolls a bank question into the user's spaced-repetition deck. */
export function AddToPractice({ questionId }: { questionId: string }) {
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enroll", questionId }),
      });
      if (res.ok) {
        setAdded(true);
        toast.success("Added to your practice deck");
      } else {
        toast.error("Couldn't add — try again.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={busy || added}
      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-60"
    >
      {added ? "✓ In your deck" : busy ? "Adding…" : "＋ Practice this"}
    </button>
  );
}
