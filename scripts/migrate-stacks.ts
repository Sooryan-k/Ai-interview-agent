/**
 * Backfills profiles.stack_ids from each user's existing enrolled curricula.
 *
 * Legacy stacks were free-text labels like "React + Node.js (Full-Stack)" or
 * "DevOps (Docker, Kubernetes, AWS)". This splits them into atomic catalog ids
 * via the alias table in lib/stacks.ts.
 *
 * Deliberate choices:
 *  - DRY RUN BY DEFAULT. Nothing is written unless you pass --apply, so the
 *    mapping can be reviewed first.
 *  - Nothing is destroyed. Curricula, enrolments and profiles.target_role are
 *    untouched; this only fills a new column. If the mapping turns out wrong,
 *    clear stack_ids and re-run.
 *  - Unmatched fragments are REPORTED, never silently dropped.
 *  - Users with more than 10 resolved stacks keep all of them. The picker asks
 *    them to trim; we never cut someone's data for them.
 *
 * Usage:
 *   npx tsx scripts/migrate-stacks.ts            # dry run, prints the plan
 *   npx tsx scripts/migrate-stacks.ts --apply    # writes stack_ids
 *   npx tsx scripts/migrate-stacks.ts --apply --force   # re-run already-migrated rows
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_STACKS, resolveStackList, stackName } from "@/lib/stacks";
import { suggestRoleFromStacks } from "@/lib/roles";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

interface Row {
  id: string;
  username: string | null;
  role_id: string | null;
  stack_ids: string[] | null;
  stacks_migrated_at: string | null;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
        "Run with your .env.local loaded, e.g.:\n" +
        "  set -a && . ./.env.local && set +a && npx tsx scripts/migrate-stacks.ts"
    );
    process.exit(1);
  }

  const db = createAdminClient();

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, username, role_id, stack_ids, stacks_migrated_at");
  if (pErr) throw new Error(`reading profiles failed: ${pErr.message}`);

  const { data: enrolments, error: eErr } = await db
    .from("user_track_progress")
    .select("user_id, curricula ( stack_label )");
  if (eErr) throw new Error(`reading enrolments failed: ${eErr.message}`);

  // user id -> the legacy stack labels they're enrolled in
  const legacy = new Map<string, string[]>();
  for (const row of enrolments ?? []) {
    const cur = Array.isArray(row.curricula) ? row.curricula[0] : row.curricula;
    const label = (cur as { stack_label?: string } | null)?.stack_label;
    if (!label) continue;
    const list = legacy.get(row.user_id as string) ?? [];
    list.push(label);
    legacy.set(row.user_id as string, list);
  }

  const unmatchedReport = new Map<string, string[]>(); // fragment -> user ids
  let planned = 0;
  let skippedAlready = 0;
  let noLegacy = 0;
  let overLimit = 0;

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — ${profiles?.length ?? 0} profiles, ` +
      `${legacy.size} with enrolments\n`
  );

  for (const p of (profiles ?? []) as Row[]) {
    const who = p.username ? `@${p.username}` : p.id.slice(0, 8);

    if (p.stacks_migrated_at && !FORCE) {
      skippedAlready++;
      continue;
    }
    if ((p.stack_ids?.length ?? 0) > 0 && !FORCE) {
      // Already chose stacks in the new picker — never overwrite a real choice.
      skippedAlready++;
      continue;
    }

    const labels = legacy.get(p.id) ?? [];
    if (labels.length === 0) {
      noLegacy++;
      continue;
    }

    const ids: string[] = [];
    const misses: string[] = [];
    for (const label of labels) {
      const { ids: got, unmatched } = resolveStackList(label);
      for (const id of got) if (!ids.includes(id)) ids.push(id);
      misses.push(...unmatched);
    }

    for (const m of misses) {
      const list = unmatchedReport.get(m) ?? [];
      list.push(who);
      unmatchedReport.set(m, list);
    }

    if (ids.length === 0) {
      console.log(
        `  ${who}: NO MATCH from ${JSON.stringify(labels)} — left untouched for manual review`
      );
      continue;
    }

    const suggestion = p.role_id ? null : suggestRoleFromStacks(ids);
    const overFlag = ids.length > MAX_STACKS ? `  ⚠ ${ids.length} stacks (over the ${MAX_STACKS} limit — kept, user will be asked to trim)` : "";
    if (ids.length > MAX_STACKS) overLimit++;

    console.log(
      `  ${who}: ${labels.join(" | ")}\n` +
        `      → ${ids.map(stackName).join(", ")}${overFlag}` +
        (suggestion ? `\n      role suggestion (not saved): ${suggestion}` : "")
    );
    planned++;

    if (APPLY) {
      const { error } = await db
        .from("profiles")
        .update({
          stack_ids: ids,
          // Primary is left unset — picking a favourite is the user's call.
          stacks_migrated_at: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (error) console.error(`      ✗ write failed for ${who}: ${error.message}`);
    }
  }

  console.log(
    `\n${APPLY ? "Wrote" : "Would write"} ${planned} profile(s).` +
      `\n  ${skippedAlready} already migrated or already chosen (skipped)` +
      `\n  ${noLegacy} had no enrolments to map` +
      `\n  ${overLimit} exceed the ${MAX_STACKS}-stack limit (kept in full)`
  );

  if (unmatchedReport.size > 0) {
    console.log(
      `\nUNMATCHED FRAGMENTS (${unmatchedReport.size}) — these were NOT dropped ` +
        `from any profile, they simply had no catalog entry. Add them to ` +
        `lib/stacks.ts (or as an alias) and re-run with --force:`
    );
    for (const [frag, users] of [...unmatchedReport.entries()].sort()) {
      console.log(`  "${frag}"  (${users.length} user(s): ${users.slice(0, 5).join(", ")})`);
    }
  } else {
    console.log("\nNo unmatched fragments.");
  }

  if (!APPLY) console.log("\nNothing was written. Re-run with --apply to commit.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
