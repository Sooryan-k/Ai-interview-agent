"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleSelect } from "@/components/stacks/RoleSelect";
import { createClient } from "@/lib/supabase/client";
import { roleById, suggestRoleFromStacks } from "@/lib/roles";
import { MAX_STACKS, stackNames } from "@/lib/stacks";
import { toast } from "sonner";

const DISMISS_KEY = "dryrun-ai:rolePromptDismissed";

/**
 * One-step prompt for accounts created before roles existed.
 *
 * Deliberate behaviour, per the migration requirements:
 *  - Never blocks the dashboard. It's an inline card, not a modal.
 *  - Dismissal is per-session (sessionStorage), so it reappears on the next
 *    visit until a role is actually set, rather than being gone forever after
 *    one stray click.
 *  - Any guessed role is shown as a pre-selected SUGGESTION the user confirms.
 *    It is never written to the profile on their behalf.
 *  - Existing stacks are shown back as confirmation that nothing was lost.
 */
export function RolePrompt() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "hidden" }
    | {
        status: "show";
        stackIds: string[];
        suggested: string | null;
      }
  >({ status: "loading" });

  const [roleId, setRoleId] = useState<string | null>(null);
  const [roleOther, setRoleOther] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setState({ status: "hidden" });
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return setState({ status: "hidden" });

      const { data: profile } = await supabase
        .from("profiles")
        .select("role_id, stack_ids")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      // Role already set — nothing to ask.
      if (profile?.role_id) return setState({ status: "hidden" });

      const stackIds: string[] = profile?.stack_ids ?? [];
      const suggested = suggestRoleFromStacks(stackIds);
      setRoleId(suggested);
      setState({ status: "show", stackIds, suggested });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setState({ status: "hidden" });
  }

  async function save() {
    if (state.status !== "show") return;
    if (!roleId) {
      toast.error("Pick a role first.");
      return;
    }
    if (roleId === "other" && !roleOther.trim()) {
      toast.error("Tell us your role.");
      return;
    }
    // The API requires at least one stack. Someone with none must use the full
    // editor, so send them there rather than failing with a confusing error.
    if (state.stackIds.length === 0) {
      window.location.href = "/settings";
      return;
    }
    if (state.stackIds.length > MAX_STACKS) {
      toast.info(
        `You have ${state.stackIds.length} saved technologies — trim to ${MAX_STACKS} in settings to save.`
      );
      window.location.href = "/settings";
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/stacks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId,
          roleOther,
          stackIds: state.stackIds,
          primaryStackId: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Couldn't save — try again.");
        return;
      }
      toast.success(`Role set to ${roleById(roleId)?.name}`);
      setState({ status: "hidden" });
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (state.status !== "show") return null;

  const names = stackNames(state.stackIds);

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <h3 className="pr-8 text-sm font-semibold">
        What role are you preparing for?
      </h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        It shapes how your interviews are framed — the scenarios, and the mix of
        coding, system design and behavioural questions.
        {state.suggested && (
          <>
            {" "}
            Based on your stacks we think you&apos;re a{" "}
            <strong className="text-foreground">
              {roleById(state.suggested)?.name}
            </strong>
            {" "}— change it if that&apos;s wrong.
          </>
        )}
      </p>

      {names.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Keeping your saved stacks: {names.join(", ")}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="sm:w-72">
          <RoleSelect
            value={roleId}
            onChange={setRoleId}
            otherValue={roleOther}
            onOtherChange={setRoleOther}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !roleId}>
            {saving ? "Saving…" : "Save role"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            render={<Link href="/settings">Edit stacks</Link>}
          />
        </div>
      </div>
    </div>
  );
}
