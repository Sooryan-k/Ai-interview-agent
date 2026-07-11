/**
 * A small built-in set of stdin/stdout coding problems with hidden tests.
 * Kept tiny and language-agnostic (read stdin, print result) so one Piston
 * run can grade any language.
 */

export interface CodingProblem {
  id: string;
  title: string;
  difficulty: "easy" | "medium";
  statement: string;
  tests: { stdin: string; expected: string }[];
  starters: Record<string, string>;
}

export const LANGUAGES = [
  { id: "python", label: "Python", monaco: "python" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["id"];

export const PROBLEMS: CodingProblem[] = [
  {
    id: "two-sum-count",
    title: "Pair Sum Count",
    difficulty: "easy",
    statement:
      "First line: N and target T. Second line: N integers. Print how many unordered pairs sum to T.\n\nExample:\nInput:\n5 6\n1 5 3 3 2\nOutput:\n2",
    tests: [
      { stdin: "5 6\n1 5 3 3 2\n", expected: "2" },
      { stdin: "4 8\n4 4 4 4\n", expected: "6" },
      { stdin: "3 100\n1 2 3\n", expected: "0" },
    ],
    starters: {
      python:
        "import sys\n\ndata = sys.stdin.read().split()\nn, t = int(data[0]), int(data[1])\nnums = list(map(int, data[2:2+n]))\n\n# TODO: count unordered pairs (i<j) with nums[i]+nums[j]==t\ncount = 0\nprint(count)\n",
      javascript:
        "const data = require('fs').readFileSync(0,'utf8').split(/\\s+/).filter(Boolean).map(Number);\nconst [n, t] = [data[0], data[1]];\nconst nums = data.slice(2, 2+n);\n\n// TODO: count unordered pairs (i<j) with nums[i]+nums[j]===t\nlet count = 0;\nconsole.log(count);\n",
    },
  },
  {
    id: "reverse-words",
    title: "Reverse Words",
    difficulty: "easy",
    statement:
      "Read a line of space-separated words and print them in reverse order.\n\nExample:\nInput:\nthe quick brown fox\nOutput:\nfox brown quick the",
    tests: [
      { stdin: "the quick brown fox\n", expected: "fox brown quick the" },
      { stdin: "hello\n", expected: "hello" },
      { stdin: "a b c d e\n", expected: "e d c b a" },
    ],
    starters: {
      python:
        "import sys\nline = sys.stdin.readline().strip()\n\n# TODO: print words reversed\nprint(line)\n",
      javascript:
        "const line = require('fs').readFileSync(0,'utf8').split('\\n')[0].trim();\n\n// TODO: print words reversed\nconsole.log(line);\n",
    },
  },
];

export function getProblem(id?: string): CodingProblem {
  return PROBLEMS.find((p) => p.id === id) ?? PROBLEMS[0];
}
