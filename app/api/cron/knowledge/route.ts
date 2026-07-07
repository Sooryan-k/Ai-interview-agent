import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText, parseJsonLoose } from "@/lib/gemini";

export const maxDuration = 60;

/**
 * Daily fresh-tech pipeline (Vercel cron, see vercel.json):
 * 1. Fetch HN front page (Algolia, keyless) + dev.to top articles (keyless).
 * 2. ONE batched Flash-Lite call: summarize + tag each item.
 * 3. Upsert into knowledge_items; prune items older than 30 days.
 * The daily write doubles as the Supabase free-tier keep-alive.
 */

const KnowledgeOutSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      summary: z.string(),
      tags: z.array(z.string()).catch([]),
    })
  ),
});

interface RawItem {
  source: string;
  title: string;
  url: string;
  published_at: string | null;
}

async function fetchHackerNews(): Promise<RawItem[]> {
  try {
    const res = await fetch(
      "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=25",
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits ?? [])
      .filter((h: { url?: string; points?: number }) => h.url && (h.points ?? 0) >= 50)
      .map((h: { title: string; url: string; created_at: string }) => ({
        source: "hn",
        title: h.title,
        url: h.url,
        published_at: h.created_at ?? null,
      }));
  } catch {
    return [];
  }
}

async function fetchDevTo(): Promise<RawItem[]> {
  try {
    const res = await fetch("https://dev.to/api/articles?top=1&per_page=15", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data ?? []).map(
      (a: { title: string; url: string; published_at: string }) => ({
        source: "devto",
        title: a.title,
        url: a.url,
        published_at: a.published_at ?? null,
      })
    );
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [hn, devto] = await Promise.all([fetchHackerNews(), fetchDevTo()]);
  const raw = [...hn, ...devto].slice(0, 35);
  if (raw.length === 0) {
    return NextResponse.json({ ok: true, ingested: 0, note: "no sources" });
  }

  // One batched call: summarize + tag; drop non-technical items.
  const prompt = `You are curating a tech-news digest for an engineering-interview prep app.

Here are today's items (title + url):
${raw.map((r, i) => `${i + 1}. ${r.title} — ${r.url}`).join("\n")}

Output STRICT JSON only:
{"items": [{"title": string, "url": string, "summary": string, "tags": string[]}]}

Rules:
- KEEP only items about software technologies, frameworks, languages, tools, platforms, or engineering practice. DROP politics, business gossip, hardware teardowns, and anything not useful to an interview candidate.
- summary: 1-2 sentences on what changed and why an engineer should care.
- tags: lowercase technology/role tags, e.g. ["react","frontend"], ["kubernetes","devops"], ["python","data"].
- Copy title and url through unchanged. JSON only.`;

  let parsed;
  try {
    const out = await generateText({
      tier: "turn",
      prompt,
      json: true,
      mockKind: "knowledge",
    });
    parsed = KnowledgeOutSchema.parse(parseJsonLoose(out));
  } catch (err) {
    console.error("knowledge summarize failed", err);
    return NextResponse.json({ error: "summarize_failed" }, { status: 502 });
  }

  const byUrl = new Map(raw.map((r) => [r.url, r]));
  const rows = parsed.items
    .filter((i) => byUrl.has(i.url) || i.url.startsWith("http"))
    .map((i) => ({
      source: byUrl.get(i.url)?.source ?? "hn",
      title: i.title.slice(0, 300),
      url: i.url,
      summary: i.summary.slice(0, 600),
      tags: i.tags.slice(0, 6),
      published_at: byUrl.get(i.url)?.published_at ?? null,
      fetched_at: new Date().toISOString(),
    }));

  const admin = createAdminClient();
  let ingested = 0;
  if (rows.length) {
    const { error, count } = await admin
      .from("knowledge_items")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.error("knowledge upsert failed", error);
      return NextResponse.json({ error: "db" }, { status: 500 });
    }
    ingested = count ?? rows.length;
  }

  // Prune >30 days — keeps the free-tier DB small.
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  await admin.from("knowledge_items").delete().lt("fetched_at", cutoff);

  return NextResponse.json({ ok: true, fetched: raw.length, ingested });
}
