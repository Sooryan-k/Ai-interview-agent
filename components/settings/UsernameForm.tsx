"use client";

import { useState } from "react";
import { AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { normalizeUsername, usernameError } from "@/lib/username";
import { toast } from "sonner";

export function UsernameForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
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
      toast.error("Please sign in again.");
      setSaving(false);
      return;
    }

    const { error: dbError } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", user.id);

    setSaving(false);
    if (dbError) {
      setError(
        dbError.code === "23505"
          ? "That username is already taken."
          : "Couldn't save — try a different username."
      );
      return;
    }
    setValue(username);
    toast.success("Username updated");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Username</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <Label htmlFor="username" className="sr-only">
          Username
        </Label>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-3 focus-within:ring-ring/50">
            <AtSign className="size-4 shrink-0 text-muted-foreground" />
            <Input
              id="username"
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
          <Button onClick={save} disabled={saving} className="shrink-0">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Shown as @{value || "username"} — lowercase letters, numbers,
            underscores.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
