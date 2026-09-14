"use client";

import { useMemo, useState } from "react";
import { Check, Search, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MAX_STACKS,
  STACK_BY_ID,
  STACK_CATEGORIES,
  searchStacks,
  type Stack,
} from "@/lib/stacks";
import { isRelevantToRole, rankStacksForRole, roleById } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Searchable multi-select over the tech catalog.
 *
 * Selection is stored and emitted as ids, never display names, so renaming a
 * technology later can't orphan a saved profile. A role reorders and badges the
 * list but never filters it — everything stays selectable.
 */
export function StackPicker({
  value,
  onChange,
  primaryId,
  onPrimaryChange,
  roleId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  primaryId?: string | null;
  onPrimaryChange?: (id: string | null) => void;
  roleId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const role = roleById(roleId);
  const atLimit = value.length >= MAX_STACKS;
  // Legacy profiles can arrive holding more than the cap; we never truncate,
  // we ask them to trim.
  const overLimit = value.length > MAX_STACKS;

  const ranked = useMemo(() => rankStacksForRole(roleId), [roleId]);
  const results = useMemo(() => searchStacks(query, ranked), [query, ranked]);

  /** Grouped by category for browsing; flat ranked list while searching. */
  const grouped = useMemo(() => {
    if (query.trim()) return null;
    return STACK_CATEGORIES.map((c) => ({
      ...c,
      items: results.filter((s) => s.category === c.id),
    })).filter((g) => g.items.length > 0);
  }, [query, results]);

  const recommended = useMemo(() => {
    if (query.trim() || !role || role.stackIds.length === 0) return null;
    return role.stackIds
      .map((id) => STACK_BY_ID.get(id))
      .filter((s): s is Stack => Boolean(s));
  }, [query, role]);

  function toggle(id: string) {
    if (value.includes(id)) {
      const next = value.filter((v) => v !== id);
      onChange(next);
      if (primaryId === id) onPrimaryChange?.(null);
      return;
    }
    if (atLimit) return; // guarded in the UI; the server enforces it for real
    onChange([...value, id]);
  }

  function setPrimary(id: string) {
    onPrimaryChange?.(primaryId === id ? null : id);
  }

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing selected yet — search or browse below.
          </p>
        ) : (
          value.map((id) => {
            const stack = STACK_BY_ID.get(id);
            const isPrimary = primaryId === id;
            return (
              <span
                key={id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-2.5 text-xs",
                  isPrimary
                    ? "border-primary bg-primary/10 font-medium"
                    : "bg-background"
                )}
              >
                {onPrimaryChange && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          onClick={() => setPrimary(id)}
                          aria-label={
                            isPrimary
                              ? `Unset ${stack?.name} as primary`
                              : `Set ${stack?.name} as primary`
                          }
                          className="text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Star
                            className={cn(
                              "size-3",
                              isPrimary && "fill-primary text-primary"
                            )}
                          />
                        </button>
                      }
                    />
                    <TooltipContent>
                      {isPrimary
                        ? "Your primary technology"
                        : "Mark as your primary technology"}
                    </TooltipContent>
                  </Tooltip>
                )}
                {/* Unknown ids can only come from stale saved data — show the
                    raw id rather than dropping it, so nothing vanishes silently. */}
                {stack?.name ?? id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${stack?.name ?? id}`}
                  className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Search + counter */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-3 focus-within:ring-ring/50">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 200+ technologies — try “nextjs”, “k8s”, “postgres”"
            className="border-0 px-0 shadow-none focus-visible:ring-0"
            aria-label="Search technologies"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            overLimit
              ? "font-medium text-destructive"
              : atLimit
                ? "font-medium text-primary"
                : "text-muted-foreground"
          )}
        >
          {value.length}/{MAX_STACKS}
        </span>
      </div>

      {overLimit ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          You have {value.length} technologies saved from before the limit
          existed. Nothing has been removed — please trim to {MAX_STACKS} to
          save changes.
        </p>
      ) : atLimit ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You&apos;ve reached the {MAX_STACKS}-stack limit — remove one to add
          another.
        </p>
      ) : null}

      {/* Options */}
      <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border p-3">
        {results.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”. Try the official name, or an alias like
            “k8s”.
          </p>
        )}

        {recommended && recommended.length > 0 && (
          <Group
            label={`Recommended for ${role?.name}`}
            items={recommended}
            value={value}
            atLimit={atLimit}
            roleId={roleId}
            onToggle={toggle}
          />
        )}

        {grouped
          ? grouped.map((g) => (
              <Group
                key={g.id}
                label={g.label}
                items={g.items}
                value={value}
                atLimit={atLimit}
                roleId={roleId}
                onToggle={toggle}
              />
            ))
          : results.length > 0 && (
              <Group
                label={`${results.length} result${results.length === 1 ? "" : "s"}`}
                items={results}
                value={value}
                atLimit={atLimit}
                roleId={roleId}
                onToggle={toggle}
                showCategory
              />
            )}
      </div>
    </div>
  );
}

function Group({
  label,
  items,
  value,
  atLimit,
  roleId,
  onToggle,
  showCategory = false,
}: {
  label: string;
  items: Stack[];
  value: string[];
  atLimit: boolean;
  roleId?: string | null;
  onToggle: (id: string) => void;
  showCategory?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => {
          const selected = value.includes(s.id);
          const blocked = atLimit && !selected;
          const relevant = isRelevantToRole(s.id, roleId);
          return (
            <button
              key={s.id}
              type="button"
              disabled={blocked}
              aria-pressed={selected}
              onClick={() => onToggle(s.id)}
              title={
                blocked
                  ? `Limit reached — remove one to add ${s.name}`
                  : showCategory
                    ? `${s.name} · ${s.category}`
                    : s.name
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : blocked
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-accent",
                !selected && relevant && !blocked && "border-primary/40"
              )}
            >
              {selected && <Check className="size-3" />}
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
