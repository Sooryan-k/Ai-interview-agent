/**
 * Target roles. Separate from stacks: the role shapes how an interview is
 * framed (scenario type, the coding / system-design / behavioural balance, and
 * the interviewer's tone), while stacks decide the subject matter.
 *
 * Adding a role needs no UI changes — append an entry here. `emphasis` feeds
 * the interviewer prompt; `stackCategories` and `stackIds` only reorder the
 * stack picker and never restrict it.
 */

import { STACKS, type Stack, type StackCategory } from "@/lib/stacks";

export interface Role {
  id: string;
  name: string;
  /** One line shown under the name in the picker. */
  blurb: string;
  /** Handed to the interviewer prompt to set scenario type and balance. */
  emphasis: string;
  /** Categories surfaced first in the stack picker for this role. */
  stackCategories: StackCategory[];
  /** Specific technologies pinned to the very top, ahead of their category. */
  stackIds: string[];
}

export const ROLES: Role[] = [
  {
    id: "frontend",
    name: "Frontend Developer",
    blurb: "UI engineering, browser behaviour, component architecture",
    emphasis:
      "Favour UI architecture, component design, state management, rendering and browser behaviour, accessibility and web performance. Use frontend system design (component hierarchies, data fetching, caching) rather than distributed-systems design.",
    stackCategories: ["frontend", "language", "testing", "api-arch"],
    stackIds: ["react", "typescript", "javascript", "nextjs", "tailwindcss", "vuejs"],
  },
  {
    id: "backend",
    name: "Backend Developer",
    blurb: "APIs, services, data modelling, server-side performance",
    emphasis:
      "Favour API design, data modelling, transactions and concurrency, caching, queues and failure handling. System design should cover services, storage and scaling rather than UI.",
    stackCategories: ["backend", "database", "api-arch", "language"],
    stackIds: ["nodejs", "python", "java", "postgresql", "rest", "express"],
  },
  {
    id: "fullstack",
    name: "Full Stack Developer",
    blurb: "End-to-end features across client, server and database",
    emphasis:
      "Balance frontend and backend roughly evenly, and probe the seams between them: API contracts, auth flows, data fetching, and where logic should live. Expect them to reason end-to-end about a feature.",
    stackCategories: ["frontend", "backend", "database", "api-arch"],
    stackIds: ["react", "nodejs", "typescript", "nextjs", "postgresql", "rest"],
  },
  {
    id: "mobile",
    name: "Mobile Developer",
    blurb: "iOS, Android and cross-platform apps",
    emphasis:
      "Favour app lifecycle, navigation, offline behaviour and sync, state management, battery and memory constraints, platform guidelines, and release/store considerations.",
    stackCategories: ["mobile", "language", "api-arch", "testing"],
    stackIds: ["react-native", "flutter", "swift", "kotlin", "swiftui", "jetpack-compose"],
  },
  {
    id: "devops",
    name: "DevOps Engineer",
    blurb: "CI/CD, containers, infrastructure as code",
    emphasis:
      "Favour build and deployment pipelines, containerisation, infrastructure as code, observability, rollout and rollback strategy, and incident response. Prefer practical scenarios over algorithm puzzles.",
    stackCategories: ["devops", "tools", "api-arch", "language"],
    stackIds: ["docker", "kubernetes", "terraform", "aws", "github-actions", "linux"],
  },
  {
    id: "cloud",
    name: "Cloud / Platform Engineer",
    blurb: "Cloud architecture, platform services, cost and scale",
    emphasis:
      "Favour cloud architecture, managed services and their trade-offs, networking, identity and access, multi-region design, and cost/performance balance. Lean heavily on system design.",
    stackCategories: ["devops", "api-arch", "database", "language"],
    stackIds: ["aws", "azure", "gcp", "kubernetes", "terraform", "microservices"],
  },
  {
    id: "data-engineer",
    name: "Data Engineer",
    blurb: "Pipelines, warehouses, batch and streaming",
    emphasis:
      "Favour pipeline design, batch vs streaming trade-offs, schema and partitioning, data quality and idempotency, backfills, and warehouse modelling. SQL depth matters more than frontend concerns.",
    stackCategories: ["data-ai", "database", "language", "devops"],
    stackIds: ["python", "sql", "spark", "airflow", "kafka", "snowflake"],
  },
  {
    id: "data-scientist",
    name: "Data Scientist",
    blurb: "Analysis, statistics, experimentation, modelling",
    emphasis:
      "Favour statistics and experiment design, feature engineering, model selection and evaluation, and communicating findings to non-technical stakeholders. Include a case-study style question.",
    stackCategories: ["data-ai", "language", "database"],
    stackIds: ["python", "pandas", "numpy", "scikit-learn", "sql", "jupyter"],
  },
  {
    id: "ml-ai",
    name: "ML / AI Engineer",
    blurb: "Training, serving and shipping models",
    emphasis:
      "Favour model architecture and training, evaluation, inference and serving, latency and cost, data pipelines for ML, and productionisation. Include deployment and monitoring, not just modelling.",
    stackCategories: ["data-ai", "language", "devops", "api-arch"],
    stackIds: ["python", "pytorch", "tensorflow", "scikit-learn", "langchain", "mlflow"],
  },
  {
    id: "qa",
    name: "QA / Test Engineer",
    blurb: "Test strategy, automation, quality gates",
    emphasis:
      "Favour test strategy and the testing pyramid, what to automate and what not to, flaky-test handling, coverage vs confidence, bug triage, and building quality into CI.",
    stackCategories: ["testing", "language", "tools", "api-arch"],
    stackIds: ["playwright", "cypress", "selenium", "jest", "pytest", "postman"],
  },
  {
    id: "sre",
    name: "Site Reliability Engineer",
    blurb: "Reliability, observability, incident response",
    emphasis:
      "Favour SLIs/SLOs and error budgets, monitoring and alerting, debugging production incidents, capacity planning, and postmortems. Use realistic outage scenarios and ask how they'd diagnose under pressure.",
    stackCategories: ["devops", "api-arch", "language", "database"],
    stackIds: ["kubernetes", "linux", "prometheus", "grafana", "terraform", "datadog"],
  },
  {
    id: "security",
    name: "Security Engineer",
    blurb: "Application security, threat modelling, hardening",
    emphasis:
      "Favour threat modelling, common vulnerability classes and their mitigations, authentication and authorisation design, secrets handling, and secure-by-default architecture.",
    stackCategories: ["security", "api-arch", "devops", "language"],
    stackIds: ["owasp", "oauth", "jwt", "cryptography", "linux", "penetration-testing"],
  },
  {
    id: "embedded",
    name: "Embedded Engineer",
    blurb: "Firmware, real-time systems, constrained hardware",
    emphasis:
      "Favour memory and timing constraints, interrupts and concurrency without an OS, hardware interfaces and protocols, power budgets, and debugging on-device. Prefer C/C++ reasoning over web topics.",
    stackCategories: ["embedded", "language", "api-arch"],
    stackIds: ["c", "cpp", "rtos", "arduino", "raspberry-pi", "mqtt"],
  },
  {
    id: "game",
    name: "Game Developer",
    blurb: "Engines, real-time rendering, gameplay systems",
    emphasis:
      "Favour the game loop and frame budget, rendering and physics basics, memory and performance profiling, gameplay architecture (ECS, state machines), and engine-specific trade-offs.",
    stackCategories: ["gamedev", "language", "api-arch"],
    stackIds: ["unity", "unreal-engine", "godot", "cpp", "csharp"],
  },
  {
    id: "engineering-manager",
    name: "Engineering Manager",
    blurb: "Leading teams, delivery, technical direction",
    emphasis:
      "Shift the balance heavily toward behavioural and leadership scenarios: delivery trade-offs, handling underperformance and conflict, hiring, prioritisation and stakeholder management. Keep technical depth present but secondary — they should reason about architecture, not write code.",
    stackCategories: ["api-arch", "tools", "backend", "frontend"],
    stackIds: ["system-design", "agile-scrum", "microservices", "jira"],
  },
  {
    id: "other",
    name: "Other",
    blurb: "Tell us in your own words",
    emphasis:
      "Frame the interview around the role the candidate described, balancing technical and behavioural questions sensibly for it.",
    stackCategories: [],
    stackIds: [],
  },
];

export const ROLE_BY_ID: ReadonlyMap<string, Role> = new Map(
  ROLES.map((r) => [r.id, r])
);

export function roleById(id: string | null | undefined): Role | undefined {
  return id ? ROLE_BY_ID.get(id) : undefined;
}

export function isRoleId(value: unknown): value is string {
  return typeof value === "string" && ROLE_BY_ID.has(value);
}

/**
 * Reorders the catalog so a role's relevant technologies surface first.
 * Returns EVERY stack — the role must never restrict what can be chosen.
 */
export function rankStacksForRole(
  roleId: string | null | undefined,
  pool: Stack[] = STACKS
): Stack[] {
  const role = roleById(roleId);
  if (!role) return [...pool];

  const pinned = new Map(role.stackIds.map((id, i) => [id, i]));
  const categoryRank = new Map(role.stackCategories.map((c, i) => [c, i]));

  return [...pool].sort((a, b) => {
    const pa = pinned.get(a.id) ?? Infinity;
    const pb = pinned.get(b.id) ?? Infinity;
    if (pa !== pb) return pa - pb;
    const ca = categoryRank.get(a.category) ?? Infinity;
    const cb = categoryRank.get(b.category) ?? Infinity;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });
}

/** True when this stack is one the role leans on — used to badge it. */
export function isRelevantToRole(
  stackId: string,
  roleId: string | null | undefined
): boolean {
  const role = roleById(roleId);
  if (!role) return false;
  if (role.stackIds.includes(stackId)) return true;
  const stack = STACKS.find((s) => s.id === stackId);
  return stack ? role.stackCategories.slice(0, 2).includes(stack.category) : false;
}

/**
 * Best-guess role from a user's stacks, for framing an interview before they've
 * confirmed one. Only ever shown as a suggestion — never written to the profile
 * without the user agreeing, since guessing someone's job wrong is worse than
 * asking.
 */
export function suggestRoleFromStacks(stackIds: string[]): string | null {
  if (stackIds.length === 0) return null;

  const scores = new Map<string, number>();
  for (const role of ROLES) {
    if (role.id === "other") continue;
    let score = 0;
    for (const id of stackIds) {
      if (role.stackIds.includes(id)) score += 3;
      const stack = STACKS.find((s) => s.id === id);
      if (!stack) continue;
      const catIdx = role.stackCategories.indexOf(stack.category);
      if (catIdx === 0) score += 2;
      else if (catIdx > 0) score += 1;
    }
    if (score > 0) scores.set(role.id, score);
  }
  if (scores.size === 0) return null;

  return [...scores.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  )[0][0];
}
