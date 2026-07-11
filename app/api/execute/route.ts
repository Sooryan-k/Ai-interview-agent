import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Thin proxy to the free Piston public API (keeps CORS/versioning server-side).
 * Per-user daily run cap via the existing increment_usage RPC (NOT Gemini
 * quota — Piston is free). Debounce the Run button client-side too.
 */
const PISTON = "https://emkc.org/api/v2/piston";
const DAILY_RUN_CAP = 60;

// Cache resolved language→version from /runtimes for the process lifetime.
let runtimeCache: Record<string, string> | null = null;

async function resolveVersion(language: string): Promise<string | null> {
  if (!runtimeCache) {
    try {
      const res = await fetch(`${PISTON}/runtimes`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const runtimes = (await res.json()) as {
        language: string;
        version: string;
        aliases: string[];
      }[];
      const map: Record<string, string> = {};
      for (const r of runtimes) {
        map[r.language] = r.version;
        for (const a of r.aliases) if (!map[a]) map[a] = r.version;
      }
      runtimeCache = map;
    } catch {
      return null;
    }
  }
  return runtimeCache[language] ?? null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Per-user run cap (separate scope; not Gemini). Skip counting in mock/dev.
  if (process.env.GEMINI_MOCK !== "1") {
    const { data: ok } = await supabase.rpc("increment_usage", {
      p_scope: `user:${user.id}:coding`,
      p_max: DAILY_RUN_CAP,
    });
    if (ok === false) {
      return NextResponse.json(
        { error: "cap", message: "You've hit today's code-run limit — come back tomorrow." },
        { status: 429 }
      );
    }
  }

  const body = await request.json().catch(() => null);
  const language = typeof body?.language === "string" ? body.language : "";
  const source = typeof body?.source === "string" ? body.source : "";
  const stdin = typeof body?.stdin === "string" ? body.stdin : "";
  if (!language || !source || source.length > 50_000) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const version = await resolveVersion(language);
  if (!version) {
    return NextResponse.json(
      { error: "runtime", message: "That language runtime is unavailable right now." },
      { status: 502 }
    );
  }

  try {
    const res = await fetch(`${PISTON}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version,
        files: [{ content: source }],
        stdin,
        run_timeout: 5000,
        compile_timeout: 8000,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json(
          { error: "busy", message: "Code runner is busy — wait a moment and retry." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "exec_failed" }, { status: 502 });
    }
    const data = await res.json();
    const run = data.run ?? {};
    return NextResponse.json({
      stdout: (run.stdout ?? "").slice(0, 10_000),
      stderr: (run.stderr ?? "").slice(0, 10_000),
      code: run.code ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "timeout", message: "Execution timed out (or the runner is down)." },
      { status: 504 }
    );
  }
}
