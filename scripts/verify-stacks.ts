/**
 * Catalog integrity checks. These guard the rules in lib/stacks.ts that are
 * easy to break when adding entries months from now: atomic-only, official
 * display names, unique ids, and aliases that can only mean one thing.
 * Run: npx tsx scripts/verify-stacks.ts
 */
process.env.GEMINI_MOCK = "1";

import {
  STACKS,
  STACK_CATEGORIES,
  MAX_STACKS,
  MIN_STACKS,
  resolveStackId,
  resolveStackList,
  searchStacks,
} from "@/lib/stacks";
import { ROLES, roleById, suggestRoleFromStacks, rankStacksForRole } from "@/lib/roles";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` — ${detail}`}`);
  if (!cond) failures++;
}

/** Display names that are nicknames the spec forbids. */
const FORBIDDEN_NAMES = new Set([
  "nextjs", "next js", "next", "nodejs", "node js", "node", "postgres", "psql",
  "k8s", "tailwind", "vuejs", "vue js", "nuxtjs", "mongo", "aws", "gcp",
  "sklearn", "rails", "react.js", "reactjs", "nest", "asp.net", "dotnet",
  "expressjs", "ror",
]);

function main() {
  // ---- structural integrity ----
  const ids = new Set<string>();
  const names = new Set<string>();
  const dupIds: string[] = [];
  const dupNames: string[] = [];
  for (const s of STACKS) {
    if (ids.has(s.id)) dupIds.push(s.id);
    ids.add(s.id);
    if (names.has(s.name)) dupNames.push(s.name);
    names.add(s.name);
  }
  check("ids are unique", dupIds.length === 0, dupIds.join(", "));
  check("display names are unique", dupNames.length === 0, dupNames.join(", "));
  check("catalog is substantial", STACKS.length >= 150, `only ${STACKS.length}`);

  const badCategory = STACKS.filter(
    (s) => !STACK_CATEGORIES.some((c) => c.id === s.category)
  );
  check("every entry has a known category", badCategory.length === 0,
    badCategory.map((s) => s.id).join(", "));

  const noIcon = STACKS.filter((s) => !s.icon);
  check("every entry has an icon reference", noIcon.length === 0,
    noIcon.map((s) => s.id).join(", "));

  const emptyCategories = STACK_CATEGORIES.filter(
    (c) => !STACKS.some((s) => s.category === c.id)
  );
  check("no category is empty", emptyCategories.length === 0,
    emptyCategories.map((c) => c.id).join(", "));

  // ---- atomic-only ----
  // "C++" and "C#" legitimately contain symbols; a bundle is a name joining two
  // distinct technologies.
  const bundles = STACKS.filter(
    (s) => /\s\+\s|\bstack\b|\bmern\b|\bmean\b|\bwith\b/i.test(s.name)
  );
  check("no bundled entries (atomic only)", bundles.length === 0,
    bundles.map((s) => s.name).join(", "));

  // ---- naming ----
  const nicknames = STACKS.filter((s) => FORBIDDEN_NAMES.has(s.name.toLowerCase()));
  check("no display name is a nickname", nicknames.length === 0,
    nicknames.map((s) => s.name).join(", "));

  // Casing the spec calls out explicitly.
  const expectedNames: [string, string][] = [
    ["nextjs", "Next.js"], ["nodejs", "Node.js"], ["vuejs", "Vue.js"],
    ["nestjs", "NestJS"], ["postgresql", "PostgreSQL"], ["mongodb", "MongoDB"],
    ["tailwindcss", "Tailwind CSS"], ["aspnet-core", "ASP.NET Core"],
    ["dotnet", ".NET"], ["csharp", "C#"], ["scikit-learn", "scikit-learn"],
    ["pandas", "pandas"], ["pytest", "pytest"], ["pytorch", "PyTorch"],
    ["tensorflow", "TensorFlow"], ["github-actions", "GitHub Actions"],
    ["kubernetes", "Kubernetes"], ["aws", "Amazon Web Services"],
    ["react-native", "React Native"], ["rails", "Ruby on Rails"],
    ["kafka", "Apache Kafka"], ["react", "React"], ["express", "Express"],
    ["webpack", "webpack"], ["grpc", "gRPC"], ["trpc", "tRPC"],
  ];
  const wrongName = expectedNames.filter(
    ([id, want]) => STACKS.find((s) => s.id === id)?.name !== want
  );
  check("official names and casing are exact", wrongName.length === 0,
    wrongName.map(([id, want]) => `${id} should be "${want}"`).join("; "));

  // ---- aliases ----
  const notLower = STACKS.flatMap((s) =>
    s.aliases.filter((a) => a !== a.toLowerCase()).map((a) => `${s.id}:${a}`)
  );
  check("aliases are lowercase", notLower.length === 0, notLower.join(", "));

  const owner = new Map<string, string>();
  const ambiguous: string[] = [];
  for (const s of STACKS) {
    for (const a of s.aliases) {
      const prev = owner.get(a);
      if (prev && prev !== s.id) ambiguous.push(`"${a}" (${prev} vs ${s.id})`);
      owner.set(a, s.id);
    }
  }
  check("no alias is ambiguous between two entries", ambiguous.length === 0,
    ambiguous.join(", "));

  const aliasHitsOtherName = STACKS.flatMap((s) =>
    s.aliases
      .filter((a) => STACKS.some((o) => o.id !== s.id && o.name.toLowerCase() === a))
      .map((a) => `${s.id}:${a}`)
  );
  check("no alias collides with another entry's official name",
    aliasHitsOtherName.length === 0, aliasHitsOtherName.join(", "));

  // ---- resolution (what the migration and search depend on) ----
  const mustResolve: [string, string][] = [
    ["next", "nextjs"], ["nextjs", "nextjs"], ["next js", "nextjs"],
    ["Next.js", "nextjs"], ["postgres", "postgresql"], ["psql", "postgresql"],
    ["k8s", "kubernetes"], ["tailwind", "tailwindcss"], ["node", "nodejs"],
    ["nodejs", "nodejs"], ["golang", "go"], ["sklearn", "scikit-learn"],
    ["ror", "rails"], ["react query", "tanstack-query"], ["dynamo", "dynamodb"],
  ];
  const badResolve = mustResolve.filter(([q, want]) => resolveStackId(q) !== want);
  check("aliases resolve to the right entry", badResolve.length === 0,
    badResolve.map(([q, w]) => `${q}→${resolveStackId(q)} want ${w}`).join("; "));

  check("unknown input resolves to null, not a wrong guess",
    resolveStackId("definitely not a technology") === null);

  // ---- legacy label splitting (the migration's job) ----
  const combined = resolveStackList("React + Node.js (Full-Stack)");
  check("splits a legacy combined label into atomic ids",
    combined.ids.includes("react") && combined.ids.includes("nodejs"),
    JSON.stringify(combined));

  const devops = resolveStackList("DevOps (Docker, Kubernetes, AWS)");
  check("splits a comma-separated legacy label",
    ["docker", "kubernetes", "aws"].every((id) => devops.ids.includes(id)),
    JSON.stringify(devops));

  const partial = resolveStackList("React + Fortran");
  check("reports unmatched fragments instead of dropping them",
    partial.ids.includes("react") && partial.unmatched.includes("Fortran"),
    JSON.stringify(partial));

  check("legacy label with no match yields no ids",
    resolveStackList("Underwater Basket Weaving").ids.length === 0);

  // ---- search ----
  check("search matches an alias", searchStacks("psql")[0]?.id === "postgresql");
  check("search ranks exact name first", searchStacks("go")[0]?.id === "go");
  check("search is substring-capable", searchStacks("kuber")[0]?.id === "kubernetes");
  check("empty query returns everything", searchStacks("").length === STACKS.length);

  // ---- roles ----
  check("role list is non-empty", ROLES.length >= 15, String(ROLES.length));
  check("role ids are unique", new Set(ROLES.map((r) => r.id)).size === ROLES.length);
  check("there is an Other role", ROLES.some((r) => r.id === "other"));
  check("roleById finds a known role", roleById("frontend")?.id === "frontend");
  check("roleById rejects junk", roleById("nope") === undefined);

  check("frontend role ranks React above Terraform",
    (() => {
      const ranked = rankStacksForRole("frontend").map((s) => s.id);
      return ranked.indexOf("react") < ranked.indexOf("terraform");
    })());
  check("ranking never drops entries (never restricts the list)",
    rankStacksForRole("frontend").length === STACKS.length);
  check("unknown role leaves order untouched",
    rankStacksForRole("nope").length === STACKS.length);

  check("suggests frontend from frontend-ish stacks",
    suggestRoleFromStacks(["react", "tailwindcss", "typescript"]) === "frontend");
  check("suggests devops from infra stacks",
    suggestRoleFromStacks(["docker", "kubernetes", "terraform"]) === "devops");
  check("suggests ml from unambiguous ML stacks",
    suggestRoleFromStacks(["pytorch", "tensorflow", "mlflow"]) === "ml-ai",
    String(suggestRoleFromStacks(["pytorch", "tensorflow", "mlflow"])));
  check("suggests data science from analysis stacks",
    suggestRoleFromStacks(["pandas", "numpy", "jupyter"]) === "data-scientist",
    String(suggestRoleFromStacks(["pandas", "numpy", "jupyter"])));
  // pandas + PyTorch genuinely straddles both roles; either answer is defensible
  // and it's only ever shown as a suggestion the user confirms.
  check("an ambiguous data/ML set still suggests one of the plausible roles",
    ["ml-ai", "data-scientist"].includes(
      suggestRoleFromStacks(["pytorch", "scikit-learn", "pandas"]) ?? ""
    ));
  check("no stacks yields no suggestion", suggestRoleFromStacks([]) === null);
  check("unknown stack ids yield no suggestion",
    suggestRoleFromStacks(["not-a-stack"]) === null);

  // ---- limits ----
  check("limits are 1 to 10", MIN_STACKS === 1 && MAX_STACKS === 10);

  console.log(
    failures === 0
      ? `\nALL STACK CHECKS PASSED (${STACKS.length} technologies, ${STACK_CATEGORIES.length} categories)`
      : `\n${failures} STACK CHECK(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
