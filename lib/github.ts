/**
 * Builds a text "digest" of a public GitHub repository for the repo-interview
 * round: file tree + README + excerpts of the most interesting source files.
 *
 * Deliberately AI-free — the digest is assembled deterministically, so adding
 * this feature costs zero Gemini quota. Only the interview turns themselves do.
 *
 * Auth is optional: unauthenticated GitHub allows 60 requests/hour per IP,
 * which is shared across serverless instances and runs out fast. Set
 * GITHUB_TOKEN (a classic token with no scopes is enough for public repos)
 * to get 5,000/hour.
 */

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export interface RepoRef {
  owner: string;
  repo: string;
}

/** Accepts a full URL, a git@ URL, or a bare "owner/repo". */
export function parseRepoRef(input: string): RepoRef | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (!s) return null;

  const patterns = [
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/?#]+)/i,
    /^git@github\.com:([^/]+)\/([^/?#]+)$/i,
    /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return { owner: m[1], repo: m[2] };
  }
  return null;
}

const API = "https://api.github.com";

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "DryRun-AI-Interview-Agent",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch(url: string): Promise<Response> {
  const res = await fetch(url, { headers: headers() });
  if (res.status === 404) {
    throw new GitHubError(
      "Repository not found. It must be public — private repos aren't supported.",
      404
    );
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError(
      "GitHub rate limit reached. Try again in a few minutes.",
      429
    );
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub request failed (${res.status}).`, 502);
  }
  return res;
}

// Directories and file types that carry no signal about how the author thinks.
const SKIP_DIR =
  /(^|\/)(node_modules|\.git|dist|build|out|target|vendor|\.next|\.venv|venv|__pycache__|coverage|\.cache|public\/assets|migrations\/\.keep)(\/|$)/i;
const SKIP_FILE =
  /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|go\.sum|\.min\.(js|css)$|\.(png|jpe?g|gif|svg|ico|webp|pdf|zip|gz|mp4|mp3|woff2?|ttf|eot|lock|snap)$)/i;
// .json is included so manifests (package.json, tsconfig) can be picked —
// lock files are already excluded by SKIP_FILE, and the size penalty in
// scoreFile() keeps large data blobs out.
const CODE_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|cpp|cc|c|h|hpp|swift|scala|ex|exs|sql|sh|yml|yaml|toml|json)$/i;

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

// Sample/demo/doc trees look like real code to a scorer but say nothing about
// how the author designed *their* system.
const PERIPHERAL_DIR =
  /(^|\/)(examples?|demos?|samples?|docs?|website|benchmarks?|fixtures?|__mocks__|scripts?|tools?|e2e)\//i;

/** Prefers files that reveal architecture: entrypoints, config, then big modules. */
function scoreFile(entry: TreeEntry): number {
  const p = entry.path.toLowerCase();
  const depth = p.split("/").length;
  let score = 0;

  if (/(^|\/)(index|main|app|server|routes?|api)\.[a-z]+$/.test(p)) score += 30;
  if (/(^|\/)(schema|model|models|db|database)\b/.test(p)) score += 22;
  if (/(^|\/)(package\.json|pyproject\.toml|go\.mod|cargo\.toml|dockerfile)$/i.test(p))
    score += 20;
  if (/(^|\/)(src|lib|app|server|core)\//.test(p)) score += 10;
  if (/(test|spec|__tests__|\.d\.ts$)/.test(p)) score -= 25;
  // Must outweigh the entrypoint bonus: examples/foo/index.js is not the app.
  if (PERIPHERAL_DIR.test(p)) score -= 45;

  score -= depth * 2; // shallower files are usually more central
  const size = entry.size ?? 0;
  if (size > 800 && size < 60_000) score += 8; // substantial but not generated
  if (size >= 60_000) score -= 15;
  return score;
}

/**
 * Greedy pick that keeps at most `perDir` files from any one directory, so a
 * single fat folder can't crowd out the rest of the architecture.
 */
function pickSpread(
  entries: TreeEntry[],
  limit: number,
  perDir = 2
): TreeEntry[] {
  const counts = new Map<string, number>();
  const chosen: TreeEntry[] = [];
  for (const e of entries) {
    if (chosen.length >= limit) break;
    const dir = e.path.includes("/")
      ? e.path.slice(0, e.path.lastIndexOf("/"))
      : ".";
    const n = counts.get(dir) ?? 0;
    if (n >= perDir) continue;
    counts.set(dir, n + 1);
    chosen.push(e);
  }
  return chosen;
}

export interface RepoDigest {
  label: string;
  digest: string;
  fileCount: number;
  truncated: boolean;
}

const MAX_DIGEST_BYTES = 24_000;
const MAX_FILES = 8;
const MAX_FILE_BYTES = 4_000;

/**
 * Fetches metadata, tree and a handful of key files, then formats them into a
 * single prompt-ready string capped at MAX_DIGEST_BYTES.
 */
export async function buildRepoDigest(ref: RepoRef): Promise<RepoDigest> {
  const metaRes = await ghFetch(`${API}/repos/${ref.owner}/${ref.repo}`);
  const meta = (await metaRes.json()) as {
    full_name: string;
    description: string | null;
    language: string | null;
    default_branch: string;
    stargazers_count: number;
    topics?: string[];
  };

  const treeRes = await ghFetch(
    `${API}/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(
      meta.default_branch
    )}?recursive=1`
  );
  const treeJson = (await treeRes.json()) as {
    tree?: TreeEntry[];
    truncated?: boolean;
  };
  const all = (treeJson.tree ?? []).filter((e) => e.type === "blob");
  const usable = all.filter(
    (e) => !SKIP_DIR.test(e.path) && !SKIP_FILE.test(e.path)
  );
  if (usable.length === 0) {
    throw new GitHubError(
      "That repo has no readable source files to interview you on.",
      422
    );
  }

  const readmeEntry = usable.find((e) => /^readme(\.|$)/i.test(e.path));
  const codeFiles = pickSpread(
    usable
      .filter((e) => CODE_EXT.test(e.path) && e !== readmeEntry)
      .sort((a, b) => scoreFile(b) - scoreFile(a)),
    MAX_FILES
  );

  const picked = readmeEntry ? [readmeEntry, ...codeFiles] : codeFiles;
  const contents = await Promise.all(
    picked.map(async (entry) => {
      try {
        const raw = await fetch(
          `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${meta.default_branch}/${entry.path}`,
          { headers: headers() }
        );
        if (!raw.ok) return null;
        const text = await raw.text();
        const clipped =
          text.length > MAX_FILE_BYTES
            ? `${text.slice(0, MAX_FILE_BYTES)}\n… [truncated]`
            : text;
        return { path: entry.path, text: clipped };
      } catch {
        return null; // one unreadable file shouldn't sink the whole digest
      }
    })
  );

  // A shallow tree listing gives the model architecture context cheaply.
  const treeList = usable
    .slice(0, 220)
    .map((e) => e.path)
    .join("\n");

  const parts: string[] = [
    `Repository: ${meta.full_name}`,
    meta.description ? `Description: ${meta.description}` : "",
    meta.language ? `Primary language: ${meta.language}` : "",
    meta.topics?.length ? `Topics: ${meta.topics.join(", ")}` : "",
    ``,
    `FILE TREE (${usable.length} source files${
      treeJson.truncated ? ", listing truncated by GitHub" : ""
    }):`,
    treeList,
  ].filter(Boolean);

  let digest = parts.join("\n");
  let truncated = false;
  for (const file of contents) {
    if (!file) continue;
    const block = `\n\n--- FILE: ${file.path} ---\n${file.text}`;
    if (digest.length + block.length > MAX_DIGEST_BYTES) {
      truncated = true;
      break;
    }
    digest += block;
  }

  return {
    label: meta.full_name,
    digest,
    fileCount: usable.length,
    truncated: truncated || Boolean(treeJson.truncated),
  };
}
