import { EVAL_SENTINEL, END_MARKER } from "@/lib/schemas";

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
  | "bank";

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

/** Scripted interviewer turns so a full mock interview can be run offline. */
function mockTurn(turnIdx: number): string {
  const turns = [
    // First AI turn: greeting + first question, eval is null (no prior answer).
    `Hi, I'm Alex — I'll be running your technical screen today. Let's ease in: can you explain the difference between let, const and var in JavaScript, and when you'd reach for each?${EVAL_SENTINEL}null`,
    `Good — you touched on scoping, which is the core of it. Follow-up: what actually happens when you access a let variable before its declaration, and why?${EVAL_SENTINEL}{"score": 7, "note": "Solid scoping explanation with an example; missed the temporal dead zone.", "tags": ["javascript", "scoping"]}`,
    `Nice. Let's switch gears to async. Walk me through what this logs and why: a Promise.resolve().then vs a setTimeout with delay 0.${EVAL_SENTINEL}{"score": 6, "note": "Correct on hoisting mechanics, hesitant on TDZ terminology.", "tags": ["javascript", "hoisting"]}`,
    `That's a reasonable mental model. Thanks — that's all we have time for today. You showed solid fundamentals; we'll put together detailed feedback now.\n${END_MARKER}${EVAL_SENTINEL}{"score": 7, "note": "Got microtask vs macrotask ordering right at a high level.", "tags": ["javascript", "event-loop"]}`,
  ];
  return turns[Math.min(turnIdx, turns.length - 1)];
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
    case "turn":
      return mockTurn(turnIdx);
  }
}
