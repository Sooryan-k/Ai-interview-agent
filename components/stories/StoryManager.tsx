"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Story {
  id: string;
  title: string;
  raw_md: string;
  polished_md: string | null;
  tags: string[];
  updated_at: string;
}

export function StoryManager({ initial }: { initial: Story[] }) {
  const [stories, setStories] = useState<Story[]>(initial);
  const [title, setTitle] = useState("");
  const [raw, setRaw] = useState("");
  const [creating, setCreating] = useState(false);
  const [polishing, setPolishing] = useState<string | null>(null);

  async function create() {
    if (!title.trim()) {
      toast.error("Give your story a title first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, raw }),
      });
      const data = await res.json();
      if (res.ok) {
        setStories((s) => [data.story, ...s]);
        setTitle("");
        setRaw("");
        toast.success("Story saved — polish it into STAR format when ready.");
      } else {
        toast.error("Couldn't save — try again.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setCreating(false);
    }
  }

  async function polish(id: string) {
    setPolishing(id);
    try {
      const res = await fetch(`/api/stories/${id}/polish`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStories((s) => s.map((st) => (st.id === id ? data.story : st)));
        toast.success("Polished into STAR format ✨");
      } else {
        toast.error(data.message || "Couldn't polish right now — try later.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setPolishing(null);
    }
  }

  async function remove(id: string) {
    setStories((s) => s.filter((st) => st.id !== id));
    await fetch(`/api/stories/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a story</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Title — e.g. “Rescued the Black Friday outage”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <Textarea
            placeholder="Rough notes are fine — what happened, what you did, how it turned out. The agent polishes it into STAR format."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end">
            <Button onClick={create} disabled={creating}>
              {creating ? "Saving…" : "Save story"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {stories.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No stories yet. Add 3-5 strong experiences (leadership, conflict,
          failure, impact) — the interviewer will draw on them in behavioral
          rounds.
        </p>
      ) : (
        <div className="space-y-4">
          {stories.map((story) => (
            <Card key={story.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-base">{story.title}</CardTitle>
                  <div className="flex shrink-0 items-center gap-2">
                    {story.tags?.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {story.polished_md ? (
                  <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                    {story.polished_md}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {story.raw_md || "(no notes yet)"}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={story.polished_md ? "outline" : "default"}
                    onClick={() => polish(story.id)}
                    disabled={polishing === story.id}
                  >
                    {polishing === story.id ? (
                      "Polishing…"
                    ) : story.polished_md ? (
                      "Re-polish"
                    ) : (
                      <>
                        <Sparkles data-icon="inline-start" /> Polish to STAR
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(story.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
