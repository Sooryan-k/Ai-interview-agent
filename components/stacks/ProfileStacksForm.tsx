"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RoleSelect } from "@/components/stacks/RoleSelect";
import { StackPicker } from "@/components/stacks/StackPicker";
import { MAX_STACKS } from "@/lib/stacks";
import { toast } from "sonner";

export interface ProfileStacksValue {
  roleId: string | null;
  roleOther: string;
  stackIds: string[];
  primaryStackId: string | null;
}

/**
 * The shared role + stacks editor, used by both onboarding and settings so the
 * two can't drift apart.
 */
export function ProfileStacksForm({
  initial,
  onSaved,
  submitLabel = "Save",
}: {
  initial: ProfileStacksValue;
  onSaved?: (value: ProfileStacksValue) => void;
  submitLabel?: string;
}) {
  const [roleId, setRoleId] = useState<string | null>(initial.roleId);
  const [roleOther, setRoleOther] = useState(initial.roleOther);
  const [stackIds, setStackIds] = useState<string[]>(initial.stackIds);
  const [primaryStackId, setPrimaryStackId] = useState<string | null>(
    initial.primaryStackId
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    if (stackIds.length === 0) {
      toast.error("Pick at least one technology.");
      return;
    }
    if (stackIds.length > MAX_STACKS) {
      toast.error(
        `Remove ${stackIds.length - MAX_STACKS} to get down to ${MAX_STACKS}.`
      );
      return;
    }
    if (roleId === "other" && !roleOther.trim()) {
      toast.error("Tell us your role.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/stacks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, roleOther, stackIds, primaryStackId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Couldn't save — try again.");
        return;
      }
      toast.success("Saved");
      onSaved?.({ roleId, roleOther, stackIds, primaryStackId });
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Role &amp; tech stack</CardTitle>
        <CardDescription>
          Your role shapes how interviews are framed; your stacks decide what
          they&apos;re about. Pick 1–{MAX_STACKS} technologies — one is fine.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm">Target role</Label>
          <RoleSelect
            value={roleId}
            onChange={setRoleId}
            otherValue={roleOther}
            onOtherChange={setRoleOther}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Tech stack</Label>
          <StackPicker
            value={stackIds}
            onChange={setStackIds}
            primaryId={primaryStackId}
            onPrimaryChange={setPrimaryStackId}
            roleId={roleId}
          />
        </div>

        <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : submitLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
