"use client";

import { useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { normalizeUsername, usernameError } from "@/lib/username";
import { toast } from "sonner";

/**
 * Blocking, non-dismissible prompt for any signed-in user whose profile has
 * no username yet. Covers both cases at once: brand-new signups (magic-link
 * and Google OAuth give us no signup form to collect one on) and existing
 * users who predate the username field. `open` is fully controlled and no
 * onOpenChange is wired up, so Escape/outside-click/close-button all no-op —
 * the only way out is a successful save.
 */
export function UsernameGate() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && !profile?.username) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const username = normalizeUsername(value);
    const validationError = usernameError(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired — please refresh and sign in again.");
      setSaving(false);
      return;
    }

    const { error: dbError } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", user.id);

    setSaving(false);
    if (dbError) {
      // Postgres unique_violation on the username column.
      setError(
        dbError.code === "23505"
          ? "That username is already taken."
          : "Couldn't save — try a different username."
      );
      return;
    }
    setOpen(false);
    toast.success(`Welcome, @${username}!`);
  }

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Choose a username</DialogTitle>
            <DialogDescription>
              One more thing before you dive in — pick a username for your
              account. You can change it later in Settings.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-3 focus-within:ring-ring/50">
              <AtSign className="size-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="username"
                maxLength={20}
                className="border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                3-20 characters: lowercase letters, numbers, underscores.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !value.trim()}>
              {saving ? "Saving…" : "Continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
