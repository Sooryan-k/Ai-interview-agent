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
  return tier === "turn"
    ? process.env.GEMINI_TURN_MODEL || "gemini-2.5-flash-lite"
    : process.env.GEMINI_SMART_MODEL || "gemini-2.5-flash";
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

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ai.models.generateContent(request);
      return res.text ?? "";
    } catch (err) {
      if (attempt < 1 && isRetryable(err) && !isRateLimit(err)) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (isRateLimit(err)) throw new RateLimitError(30);
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
  try {
    const stream = await ai.models.generateContentStream({
      model: modelFor(opts.tier),
      contents: opts.prompt,
      config: {
        ...(opts.system ? { systemInstruction: opts.system } : {}),
        ...(opts.maxOutputTokens
          ? { maxOutputTokens: opts.maxOutputTokens }
          : {}),
      },
    });
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
  return JSON.parse(trimmed);
}
