"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function BankSeeder({
  roleTrack,
  roundType,
  difficulty,
}: {
  roleTrack: string;
  roundType: string;
  difficulty: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function seed() {
    setLoading(true);
    try {
      const res = await fetch("/api/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleTrack, roundType, difficulty }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Added ${data.seeded ?? "new"} questions`);
        router.refresh();
      } else {
        toast.error(data.message || "Couldn't generate right now — try later.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={seed} disabled={loading} size="sm">
      {loading ? (
        "Generating questions…"
      ) : (
        <>
          <Sparkles data-icon="inline-start" /> Generate this set
        </>
      )}
    </Button>
  );
}
