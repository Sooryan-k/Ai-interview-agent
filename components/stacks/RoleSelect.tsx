"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES, roleById } from "@/lib/roles";

/**
 * Single-select target role. Shown before the stack picker because the choice
 * reorders that list. "Other" reveals a free-text field.
 */
export function RoleSelect({
  value,
  onChange,
  otherValue,
  onOtherChange,
}: {
  value: string | null;
  onChange: (roleId: string) => void;
  otherValue: string;
  onOtherChange: (text: string) => void;
}) {
  const role = roleById(value);

  return (
    <div className="space-y-2">
      <Select value={value ?? ""} onValueChange={(v) => v && onChange(v as string)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose your role…">
            {(v) => roleById(v as string)?.name ?? "Choose your role…"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {role && role.id !== "other" && (
        <p className="text-xs text-muted-foreground">{role.blurb}</p>
      )}

      {value === "other" && (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="role-other" className="sr-only">
            Your role
          </Label>
          <Input
            id="role-other"
            value={otherValue}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="e.g. Developer Advocate, Solutions Architect…"
            maxLength={80}
          />
        </div>
      )}
    </div>
  );
}
