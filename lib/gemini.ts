import { GoogleGenAI } from "@google/genai";
import { mockResponse, type MockKind } from "@/lib/mock";

/**
 * Every Gemini call in the app flows through this module.
 * - Model tiering: 'turn' (Flash-Lite, high daily cap) vs 'smart' (Flash).
 * - Retry with backoff on 429/503 (one retry, then surface a typed error).
 * - GEMINI_MOCK=1: canned responses, zero quota, no API key needed.
 * - MOCK_429=1: every call throws RateLimitError (tests the 429 UX).
 */

export type Tier = "turn" | "smart";

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds = 30) {
    super("AI rate limit reached");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function modelFor(tier: Tier): string {
  // Rolling "-latest" aliases: stable pointers that won't get deprecated out
  // from under us (dated snapshots like gemini-2.5-flash are retired for new keys).
  // Default both tiers to flash-lite — on the free tier the heavier flash model
  // is frequently 503-overloaded. Override GEMINI_SMART_MODEL for higher quality
  // once you have quota headroom.
  return tier === "turn"
    ? process.env.GEMINI_TURN_MODEL || "gemini-flash-lite-latest"
    : process.env.GEMINI_SMART_MODEL || "gemini-flash-lite-latest";
}

function isMock() {
  return process.env.GEMINI_MOCK === "1";
}

function shouldMock429() {
  return process.env.MOCK_429 === "1";
}

function isRetryable(err: unknown): boolean {
  const s = String(err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(s);
}

function isRateLimit(err: unknown): boolean {
  return /429|RESOURCE_EXHAUSTED/i.test(String(err));
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set (or set GEMINI_MOCK=1 for offline dev)"
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export interface GenerateOptions {
  tier: Tier;
  system?: string;
  prompt: string;
  json?: boolean;
  maxOutputTokens?: number;
  /** Which canned fixture to return in mock mode. */
  mockKind: MockKind;
  /** For 'turn' fixtures: index of the AI turn being generated. */
  mockTurnIdx?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Non-streaming generation. Returns the full text. */
export async function generateText(opts: GenerateOptions): Promise<string> {
  if (shouldMock429()) throw new RateLimitError(20);
  if (isMock()) return mockResponse(opts.mockKind, opts.mockTurnIdx ?? 0);

  const ai = getClient();
  const request = {
    model: modelFor(opts.tier),
    contents: opts.prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      ...(opts.maxOutputTokens
        ? { maxOutputTokens: opts.maxOutputTokens }
        : {}),
    },
  };

  // Retry transient 503/overload a few times with exponential backoff — the
  // free tier throws these intermittently. Rate limits (429) are NOT retried.
  const MAX_RETRIES = 3;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ai.models.generateContent(request);
      return res.text ?? "";
    } catch (err) {
      if (isRateLimit(err)) throw new RateLimitError(30);
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        await sleep(1200 * 2 ** attempt); // 1.2s, 2.4s, 4.8s
        continue;
      }
      throw err;
    }
  }
}

/** Streaming generation. Yields text chunks as they arrive. */
export async function* streamText(
  opts: GenerateOptions
): AsyncGenerator<string> {
  if (shouldMock429()) throw new RateLimitError(20);
  if (isMock()) {
    // Simulate streaming by emitting the fixture in small chunks.
    const full = mockResponse(opts.mockKind, opts.mockTurnIdx ?? 0);
    const words = full.split(/(?<=\s)/);
    for (let i = 0; i < words.length; i += 4) {
      yield words.slice(i, i + 4).join("");
      await sleep(30);
    }
    return;
  }

  const ai = getClient();
  const request = {
    model: modelFor(opts.tier),
    contents: opts.prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      ...(opts.maxOutputTokens
        ? { maxOutputTokens: opts.maxOutputTokens }
        : {}),
    },
  };

  // Retry opening the stream on transient 503/overload (before any bytes flow).
  // Once chunks start arriving we can't safely restart, so only the open retries.
  const MAX_RETRIES = 3;
  let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
  for (let attempt = 0; ; attempt++) {
    try {
      stream = await ai.models.generateContentStream(request);
      break;
    } catch (err) {
      if (isRateLimit(err)) throw new RateLimitError(30);
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        await sleep(1200 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }

  try {
    for await (const chunk of stream) {
      const t = chunk.text;
      if (t) yield t;
    }
  } catch (err) {
    if (isRateLimit(err)) throw new RateLimitError(30);
    throw err;
  }
}

/**
 * Parse a JSON response that may be wrapped in markdown code fences
 * (Gemini occasionally does this even with responseMimeType set).
 */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Models sometimes append trailing text/tokens after a valid JSON value.
    // Extract the first complete balanced object/array via a brace scan that
    // respects string literals and escapes.
    const extracted = extractFirstJson(trimmed);
    if (extracted !== null) return JSON.parse(extracted);
    throw new Error("No parseable JSON found in model output");
  }
}

function extractFirstJson(s: string): string | null {
  const startObj = s.indexOf("{");
  const startArr = s.indexOf("[");
  let start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start === -1) return null;

  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null; // unbalanced — truncated output
}
