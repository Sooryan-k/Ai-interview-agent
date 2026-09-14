"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STACK_BY_ID,
  STACK_CATEGORIES,
  searchStacks,
  stackNames,
  type Stack,
} from "@/lib/stacks";
import { isRelevantToRole, rankStacksForRole, roleById } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * The "what is this interview about" field.
 *
 * Two ways in: the technologies already on your profile are offered as one-tap
 * suggestions, and the whole catalog is browsable underneath. Free text still
 * works, because an interview can be about something the catalog doesn't know.
 *
 * The parent only ever sees the composed label (e.g. "React + Node.js"), which
 * is what gets stored on the interview and shown in the report.
 */

/** One interview stays focused; this also keeps the composed label readable. */
export const MAX_INTERVIEW_STACKS = 6;

export function InterviewStackField({
  defaultStackIds,
  defaultCustom,
  suggestedIds,
  primaryStackId,
  roleId,
  onChange,
  onStacksChange,
}: {
  defaultStackIds: string[];
  defaultCustom: string;
  /** Technologies from the user's profile, offered as one-tap suggestions. */
  suggestedIds: string[];
  primaryStackId?: string | null;
  roleId?: string | null;
  onChange: (label: string) => void;
  /** The catalog ids behind the label — these drive the question count. */
  onStacksChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(defaultStackIds);
  const [custom, setCustom] = useState(defaultCustom);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const role = roleById(roleId);
  const atLimit = selected.length >= MAX_INTERVIEW_STACKS;

  const label = useMemo(
    () =>
      [...stackNames(selected), custom.trim()].filter(Boolean).join(" + "),
    [selected, custom]
  );

  // Keep the parent's submit value in step with the selection.
  useEffect(() => {
    onChange(label);
  }, [label, onChange]);

  useEffect(() => {
    onStacksChange?.(selected);
  }, [selected, onStacksChange]);

  // Suggestions are the profile's stacks, primary first, minus what's chosen.
  const suggestions = useMemo(() => {
    const ordered = [...suggestedIds].sort((a, b) =>
      a === primaryStackId ? -1 : b === primaryStackId ? 1 : 0
    );
    return ordered
      .filter((id) => !selected.includes(id))
      .map((id) => STACK_BY_ID.get(id))
      .filter((s): s is Stack => Boolean(s));
  }, [suggestedIds, primaryStackId, selected]);

  const ranked = useMemo(() => rankStacksForRole(roleId), [roleId]);
  const results = useMemo(() => searchStacks(query, ranked), [query, ranked]);

  /** Grouped by category for browsing; one flat ranked list while searching. */
  const grouped = useMemo(() => {
    if (query.trim()) return null;
    return STACK_CATEGORIES.map((c) => ({
      ...c,
      items: results.filter((s) => s.category === c.id),
    })).filter((g) => g.items.length > 0);
  }, [query, results]);

  function add(id: string) {
    if (selected.includes(id) || atLimit) return;
    setSelected([...selected, id]);
    setQuery("");
  }

  function remove(id: string) {
    setSelected(selected.filter((v) => v !== id));
  }

  function toggle(id: string) {
    if (selected.includes(id)) remove(id);
    else add(id);
  }

  function addAllSuggestions() {
    const room = MAX_INTERVIEW_STACKS - selected.length;
    setSelected([...selected, ...suggestions.slice(0, room).map((s) => s.id)]);
  }

  // Escape closes the browser without losing the selection.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hasCustom = custom.trim().length > 0;
  const nothingChosen = selected.length === 0 && !hasCustom;

  return (
    <div className="space-y-2" ref={panelRef}>
      {/* What this interview will be about */}
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-background p-2",
          nothingChosen && "text-muted-foreground"
        )}
      >
        {nothingChosen && (
          <span className="px-1 text-sm">
            Pick your technologies below — e.g. React + Node.js
          </span>
        )}
        {selected.map((id) => {
          const stack = STACK_BY_ID.get(id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 py-1 pr-1 pl-2.5 text-xs font-medium"
            >
              {stack?.name ?? id}
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Remove ${stack?.name ?? id}`}
                className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        {hasCustom && (
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed py-1 pr-1 pl-2.5 text-xs">
            {custom.trim()}
            <button
              type="button"
              onClick={() => setCustom("")}
              aria-label={`Remove ${custom.trim()}`}
              className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        )}
      </div>

      {/* Suggestions from their profile — the fast path */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Your stack:
          </span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={atLimit}
              onClick={() => add(s.id)}
              title={
                atLimit
                  ? `Up to ${MAX_INTERVIEW_STACKS} per interview — remove one first`
                  : `Interview me on ${s.name}`
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                atLimit
                  ? "cursor-not-allowed opacity-40"
                  : "border-primary/40 hover:bg-accent"
              )}
            >
              <Plus className="size-3" />
              {s.name}
            </button>
          ))}
          {suggestions.length > 1 && !atLimit && (
            <button
              type="button"
              onClick={addAllSuggestions}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Add all
            </button>
          )}
        </div>
      )}

      {/* Search + browse the whole catalog */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 focus-within:ring-3 focus-within:ring-ring/50">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search any technology…"
            aria-label="Search technologies"
            className="border-0 px-0 text-sm shadow-none focus-visible:ring-0"
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0"
        >
          {open ? "Done" : "Browse all"}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </Button>
      </div>

      {(open || query.trim()) && (
        <div className="max-h-64 space-y-4 overflow-y-auto rounded-lg border p-3">
          {atLimit && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Up to {MAX_INTERVIEW_STACKS} technologies per interview — remove
              one to add another.
            </p>
          )}

          {results.length === 0 && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing matches “{query}”.
              </p>
              {!hasCustom && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustom(query.trim());
                    setQuery("");
                  }}
                >
                  Interview me on “{query.trim()}” anyway
                </Button>
              )}
            </div>
          )}

          {grouped
            ? grouped.map((g) => (
                <Group
                  key={g.id}
                  label={g.label}
                  items={g.items}
                  selected={selected}
                  atLimit={atLimit}
                  roleId={roleId}
                  onToggle={toggle}
                />
              ))
            : results.length > 0 && (
                <Group
                  label={`${results.length} result${
                    results.length === 1 ? "" : "s"
                  }`}
                  items={results}
                  selected={selected}
                  atLimit={atLimit}
                  roleId={roleId}
                  onToggle={toggle}
                />
              )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {role
          ? `Questions are framed for a ${role.name} — pick the technologies this round should cover.`
          : "Pick the technologies this round should cover."}
      </p>
    </div>
  );
}

function Group({
  label,
  items,
  selected,
  atLimit,
  roleId,
  onToggle,
}: {
  label: string;
  items: Stack[];
  selected: string[];
  atLimit: boolean;
  roleId?: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => {
          const isSelected = selected.includes(s.id);
          const blocked = atLimit && !isSelected;
          const relevant = isRelevantToRole(s.id, roleId);
          return (
            <button
              key={s.id}
              type="button"
              disabled={blocked}
              aria-pressed={isSelected}
              onClick={() => onToggle(s.id)}
              title={blocked ? `Limit reached — remove one to add ${s.name}` : s.name}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : blocked
                    ? "cursor-not-allowed opacity-40"
                    : "hover:bg-accent",
                !isSelected && relevant && !blocked && "border-primary/40"
              )}
            >
              {isSelected && <Check className="size-3" />}
              {s.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
