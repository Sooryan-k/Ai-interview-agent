import { EVAL_SENTINEL } from "@/lib/schemas";

/**
 * Canned AI responses used when GEMINI_MOCK=1. Lets the entire app be
 * developed and demoed with zero Gemini quota (and no API key at all).
 */

export type MockKind =
  | "curriculum"
  | "study"
  | "turn"
  | "report"
  | "knowledge"
  | "quiz"
  | "bank"
  | "polish"
  | "roast"
  | "resume"
  | "whiteboard"
  | "codeReview";

const mockCurriculum = {
  stack_label: "React + Node.js",
  levels: [
    {
      key: "foundations",
      title: "Foundations",
      summary: "Core JavaScript, the browser, and how the web works.",
      modules: [
        {
          key: "js-core",
          title: "JavaScript Core",
          topics: [
            {
              key: "js-variables-types",
              title: "Variables, Types & Coercion",
              objective:
                "Explain let/const/var, primitive vs reference types, and coercion rules.",
              est_minutes: 45,
            },
            {
              key: "js-functions-closures",
              title: "Functions & Closures",
              objective:
                "Use closures deliberately and explain scope chains in an interview.",
              est_minutes: 60,
            },
            {
              key: "js-async",
              title: "Async: Promises & Event Loop",
              objective:
                "Trace event-loop execution order and write async/await error handling.",
              est_minutes: 60,
            },
          ],
        },
      ],
    },
    {
      key: "intermediate",
      title: "Intermediate",
      summary: "React fundamentals and building real UIs.",
      modules: [
        {
          key: "react-fundamentals",
          title: "React Fundamentals",
          topics: [
            {
              key: "react-components-props",
              title: "Components, Props & State",
              objective:
                "Design component trees and explain re-render behavior.",
              est_minutes: 60,
            },
            {
              key: "react-hooks",
              title: "Hooks in Depth",
              objective:
                "Use useEffect/useMemo/useCallback correctly and spot stale-closure bugs.",
              est_minutes: 90,
            },
          ],
        },
      ],
    },
    {
      key: "advanced",
      title: "Advanced",
      summary: "Node.js backends, APIs, and performance.",
      modules: [
        {
          key: "node-apis",
          title: "Node.js & APIs",
          topics: [
            {
              key: "node-event-loop",
              title: "Node Event Loop & Streams",
              objective:
                "Explain libuv phases and when to use streams over buffers.",
              est_minutes: 75,
            },
            {
              key: "rest-design",
              title: "REST API Design",
              objective:
                "Design resource-oriented APIs with auth, pagination, and errors.",
              est_minutes: 60,
            },
          ],
        },
      ],
    },
    {
      key: "expert",
      title: "Expert & Interview-Ready",
      summary: "System design, testing, and interview drills.",
      modules: [
        {
          key: "system-design",
          title: "Frontend System Design",
          topics: [
            {
              key: "sd-caching-state",
              title: "Caching & State Architecture",
              objective:
                "Reason about client caches, invalidation, and data-fetching layers.",
              est_minutes: 90,
            },
            {
              key: "sd-scaling-node",
              title: "Scaling Node Services",
              objective:
                "Discuss clustering, horizontal scaling, and bottleneck analysis.",
              est_minutes: 90,
            },
          ],
        },
      ],
    },
  ],
};

const mockStudy = {
  content_md: `## What it is

This topic covers the fundamentals you must be able to explain **out loud** in an interview.

### Key concepts

1. **Concept one** — the mental model interviewers expect.
2. **Concept two** — the classic follow-up question.
3. **Concept three** — where most candidates go wrong.

### Example

\`\`\`js
// A tiny example an interviewer might ask you to walk through
function counter() {
  let count = 0;
  return () => ++count;
}
const next = counter();
next(); // 1
next(); // 2
\`\`\`

### Common pitfalls

- Explaining *what* without *why*.
- Memorizing syntax instead of the underlying model.
`,
  cheat_sheet_md: `- One-liner definition you can say in 10 seconds
- The classic follow-up and its answer
- One real-world example from your own projects`,
  resources: [
    { title: "MDN Web Docs", url: "https://developer.mozilla.org" },
    { title: "javascript.info", url: "https://javascript.info" },
  ],
  interview_questions: [
    "Explain this topic to a junior engineer in two minutes.",
    "What are the trade-offs involved?",
    "Walk me through a bug you'd expect beginners to hit here.",
    "How does this interact with performance?",
    "When would you NOT use this?",
  ],
};

const mockReport = {
  overall_score: 72,
  strengths: [
    "Clear, structured answers using concrete examples",
    "Good understanding of core concepts",
  ],
  weaknesses: [
    "Answers to follow-up questions lacked depth",
    "Rarely mentioned trade-offs unprompted",
  ],
  per_question: [
    {
      q: "Explain the difference between let, const and var.",
      answer_summary: "Covered scoping correctly, missed temporal dead zone.",
      model_answer:
        "var is function-scoped and hoisted with undefined; let/const are block-scoped with a temporal dead zone; const prevents rebinding, not mutation.",
      score: 7,
    },
    {
      q: "How does the event loop handle promises vs setTimeout?",
      answer_summary: "Knew microtask vs macrotask ordering at a high level.",
      model_answer:
        "Microtasks (promise callbacks) drain completely after each task; setTimeout callbacks are macrotasks scheduled in later loop iterations.",
      score: 6,
    },
  ],
  recommendations: [
    "Re-study 'Async: Promises & Event Loop' and practice tracing output order",
    "Practice stating one trade-off in every answer",
  ],
};

const mockKnowledge = {
  items: [
    {
      title: "New React release adds compiler optimizations",
      url: "https://example.com/react-release",
      summary: "The latest React release ships automatic memoization.",
      tags: ["react", "frontend"],
    },
    {
      title: "Node.js LTS gains built-in test runner improvements",
      url: "https://example.com/node-lts",
      summary: "Node's test runner now supports better mocking.",
      tags: ["node", "backend"],
    },
  ],
};

const mockQuiz = {
  questions: [
    {
      type: "mcq",
      q: "Which statement about `const` is TRUE?",
      options: [
        "It makes objects immutable",
        "It prevents rebinding the variable",
        "It is function-scoped",
        "It hoists with value undefined",
      ],
      answer: 1,
      explanation:
        "const prevents reassignment of the binding; object contents can still mutate.",
    },
    {
      type: "mcq",
      q: "Promise callbacks run as…",
      options: ["macrotasks", "microtasks", "synchronously", "render tasks"],
      answer: 1,
      explanation:
        "Promise reactions are microtasks and drain before the next macrotask.",
    },
    {
      type: "short",
      q: "In one sentence, what is a closure?",
      ideal_points: [
        "A function that retains access to its defining scope",
        "Variables persist after the outer function returns",
      ],
      explanation:
        "A closure is a function bundled with its lexical environment.",
    },
    {
      type: "mcq",
      q: "What does the temporal dead zone apply to?",
      options: ["var only", "let/const before declaration", "globals", "imports only"],
      answer: 1,
      explanation:
        "Accessing let/const before the declaration line throws a ReferenceError.",
    },
  ],
};

const mockBank = {
  questions: [
    {
      question: "Explain the difference between == and === in JavaScript.",
      ideal_points: ["Type coercion rules", "Strict equality compares type and value"],
      tags: ["javascript", "fundamentals"],
    },
    {
      question: "How does React decide when to re-render a component?",
      ideal_points: ["State/props changes", "Reference equality", "Memoization"],
      tags: ["react", "rendering"],
    },
    {
      question: "Describe how you would paginate a REST API and why.",
      ideal_points: ["Cursor vs offset", "Stable ordering", "Page size limits"],
      tags: ["api-design", "backend"],
    },
    {
      question: "What happens from typing a URL to the page rendering?",
      ideal_points: ["DNS", "TCP/TLS", "HTTP", "Parse/render pipeline"],
      tags: ["web", "fundamentals"],
    },
    {
      question: "When would you choose WebSockets over HTTP polling?",
      ideal_points: ["Bidirectional low-latency", "Connection overhead trade-offs"],
      tags: ["networking", "realtime"],
    },
    {
      question: "Explain optimistic UI updates and their failure handling.",
      ideal_points: ["Immediate feedback", "Rollback on error", "Reconciliation"],
      tags: ["frontend", "ux"],
    },
  ],
};

const mockPolish = {
  polished_md: `**Situation** — Our checkout service was timing out under Black Friday load.\n\n**Task** — As the on-call lead I had to restore it without a full rewrite.\n\n**Action** — I profiled the hot path, found an N+1 query, added a cache layer, and shipped behind a flag.\n\n**Result** — p95 latency dropped [quantify: e.g. from 3s to 400ms] and checkout held through peak.`,
  tags: ["ownership", "performance"],
};

const mockRoast = {
  roast_md: `Your resume says "results-driven team player" — so does everyone's. 😅\n\nBut real talk: you list six tools and zero outcomes. Recruiters skim for impact, not inventory.`,
  fixes: [
    "Replace 'responsible for X' with 'did X, which achieved Y' — lead with the result.",
    "Cut the skills soup to the 8 that matter for your target role.",
    "Add one number to every bullet — %, $, time saved, or scale.",
  ],
};

const mockResume = {
  summary: "Full-stack engineer with 4 years building React/Node products.",
  years_experience: 4,
  skills: ["react", "typescript", "node", "postgres", "aws"],
  highlights: [
    "Shipped a payments integration handling $2M/mo",
    "Led migration to TypeScript across a 60k-LOC codebase",
  ],
  gaps: ["system design at scale", "kubernetes"],
};

const mockWhiteboard = {
  overall_score: 68,
  components_identified: ["client", "API server", "database"],
  strengths: [
    "Clear request flow from client to API to database",
    "Separated the API tier from the data tier",
  ],
  bottlenecks: [
    "Single database with no replica — a read bottleneck and a single point of failure",
    "No load balancer in front of the API tier",
  ],
  missing_pieces: [
    "A cache (e.g. Redis) for hot reads",
    "A load balancer and horizontal API scaling",
    "A CDN for static assets",
  ],
  follow_up_questions: [
    "How would you scale reads as traffic grows 10x?",
    "What happens when the database goes down?",
  ],
  verdict:
    "A solid baseline design that would pass a junior screen but needs caching and redundancy for a senior bar.",
};

const mockCodeReview = {
  overall_score: 74,
  correctness: "Passes the provided tests; may not handle empty input.",
  complexity: "O(n²) time, O(1) space — a hash map would make it O(n).",
  strengths: ["Readable variable names", "Correct core logic"],
  improvements: [
    "Use a hash map to count complements in one pass",
    "Handle the empty-input edge case",
  ],
  cleaner_approach:
    "Iterate once, storing seen values in a set/dict and checking for target−x as you go.",
};

/**
 * Scripted interviewer turns so a full mock interview can be run offline.
 *
 * Two things this deliberately does NOT do, because an earlier version did both
 * and made a mocked session look like a broken one:
 *  - It never runs out. The pool cycles, so a 30-question round produces 30
 *    questions instead of repeating a canned goodbye from question 5 onward.
 *  - It never emits END_MARKER. Ending is the server's decision now; a fixture
 *    that says "that's all we have time for" on turn 4 reads exactly like the
 *    early-termination bug it isn't.
 *
 * The eval it proposes is mid-range and honest about being a guess. The server
 * recomputes the score from the candidate's actual words either way, so a
 * non-answer still lands on zero here.
 */
const MOCK_QUESTIONS: { topic: string; q: string }[] = [
  { topic: "scoping", q: "Can you explain the difference between let, const and var, and when you'd reach for each?" },
  { topic: "hoisting", q: "What actually happens when you access a let variable before its declaration, and why?" },
  { topic: "event loop", q: "Walk me through what logs first: a Promise.resolve().then or a setTimeout with delay 0?" },
  { topic: "closures", q: "What is a closure, and what's a bug you'd expect someone to hit with one in a loop?" },
  { topic: "equality", q: "Why does == behave differently from ===, and which do you reach for by default?" },
  { topic: "prototypes", q: "How does prototypal inheritance differ from classical inheritance?" },
  { topic: "async", q: "What problem do async and await solve that raw promises didn't?" },
  { topic: "error handling", q: "How would you handle a rejected promise inside an async function?" },
  { topic: "modules", q: "What's the practical difference between a default export and a named export?" },
  { topic: "immutability", q: "Why does const not stop you from mutating an object, and what would?" },
  { topic: "debouncing", q: "How would you stop a search input from firing a request on every keystroke?" },
  { topic: "memory", q: "What's a memory leak you've seen in a long-running front end, and what caused it?" },
  { topic: "http caching", q: "How would you decide between a cache-control header and an ETag?" },
  { topic: "indexes", q: "When does adding a database index make a query slower rather than faster?" },
  { topic: "transactions", q: "What does an atomic transaction guarantee you that a sequence of writes doesn't?" },
];

function mockTurn(turnIdx: number): string {
  const { topic, q } = MOCK_QUESTIONS[turnIdx % MOCK_QUESTIONS.length];
  const lead =
    turnIdx === 0
      ? "Hi — I'll be running your technical screen today. Let's ease in: "
      : "Thanks. Next: ";
  const message = `${lead}${q}`;

  const evalJson =
    turnIdx === 0
      ? "null"
      : `{"verdict": "partially_correct", "criteria": {"correctness": 5, "depth": 4, "structure": 6, "clarity": 6}, "note": "Mock eval — the server recomputes this from the real answer.", "model_answer": "A complete answer would name the mechanism and one trade-off.", "tags": ["mock"]}`;

  const questionJson = `{"stack": "", "topic": ${JSON.stringify(topic)}, "difficulty": "medium", "text": ${JSON.stringify(q)}}`;

  return `${message}${EVAL_SENTINEL}{"eval": ${evalJson}, "question": ${questionJson}}`;
}

export function mockResponse(kind: MockKind, turnIdx = 0): string {
  switch (kind) {
    case "curriculum":
      return JSON.stringify(mockCurriculum);
    case "study":
      return JSON.stringify(mockStudy);
    case "report":
      return JSON.stringify(mockReport);
    case "knowledge":
      return JSON.stringify(mockKnowledge);
    case "quiz":
      return JSON.stringify(mockQuiz);
    case "bank":
      return JSON.stringify(mockBank);
    case "polish":
      return JSON.stringify(mockPolish);
    case "roast":
      return JSON.stringify(mockRoast);
    case "resume":
      return JSON.stringify(mockResume);
    case "whiteboard":
      return JSON.stringify(mockWhiteboard);
    case "codeReview":
      return JSON.stringify(mockCodeReview);
    case "turn":
      return mockTurn(turnIdx);
  }
}
