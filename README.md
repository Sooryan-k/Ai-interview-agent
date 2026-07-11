# PrepPilot — AI Interview Agent

Sign in, pick your stack, and the agent prepares **everything** for your interviews:

- 🗺️ **Scratch → Expert roadmap** — a full curriculum (levels → modules → topics) generated for your stack
- 📚 **Study materials on demand** — explanations, annotated code, cheat sheets, curated free resources and likely interview questions per topic
- 🎙️ **Voice mock interviews** — a realistic AI interviewer (Web Speech API: free, in-browser STT + TTS) that asks follow-ups and privately scores every answer
- 📊 **Report cards** — overall score, per-question model answers, strengths/weaknesses, delivery metrics (filler words, WPM, pauses) and restudy links
- 📰 **Always current** — a daily cron ingests Hacker News + dev.to so the interviewer knows about last week's releases

**Runs 100% on free tiers**: Gemini free API, Supabase free tier, Vercel Hobby.

## Setup (~10 minutes)

### 1. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run **each** migration in order:
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then
   [`supabase/migrations/0002_stories.sql`](supabase/migrations/0002_stories.sql).
3. Auth → Providers: enable **Email** (magic link works out of the box). Optionally enable **Google** (add OAuth credentials).
4. Auth → URL Configuration: add `http://localhost:3000/**` (and your Vercel URL later) to redirect URLs.
5. Project Settings → API: copy the URL, `anon` key, and `service_role` key.

### 2. Gemini API key (free)

Create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — no credit card needed.

### 3. Environment

```bash
cp .env.example .env.local
# fill in the Supabase + Gemini values
```

### 4. Run

```bash
npm install
npm run dev
```

**Zero-quota development:** set `GEMINI_MOCK=1` in `.env.local` and the whole app (curriculum, lessons, interviews, reports) runs on canned AI responses — no API key needed, no quota burned. Set `MOCK_429=1` to test the rate-limit UX.

## Deploy (free)

1. Push to GitHub, import into [Vercel](https://vercel.com) (Hobby plan).
2. Add all env vars from `.env.local` (plus a random `CRON_SECRET`).
3. `vercel.json` registers the daily knowledge cron automatically.
4. Add your production URL to Supabase Auth redirect URLs.

## How it stays free

| Service | Free cap | How the design respects it |
|---|---|---|
| Gemini Flash-Lite | ~15 RPM / ~1k req/day | **1 call per interview turn** (question + hidden scoring in one response); study materials cached globally |
| Gemini Flash | ~250 req/day | Only for curriculum generation (once per stack, shared by all users) and end-of-interview reports |
| Supabase | 500 MB, pauses when idle | Text-only rows; 30-day knowledge pruning; the daily cron write is the keep-alive |
| Vercel Hobby | daily crons, 100 GB | One cron; streaming routes set `maxDuration: 60` |
| Voice | — | Web Speech API is fully client-side and free (best in Chrome/Edge; text always works) |

Quota guards (`daily_usage` table, atomic counter) cap per-user interviews/day and global calls/day. When the budget is spent the app degrades to **Practice Mode** — all cached curricula, lessons and quizzes stay available. Never a hard outage.

## Architecture notes

- `lib/gemini.ts` — every AI call flows through here (model tiering, backoff, mock mode)
- `app/api/interview/[id]/turn/route.ts` — the turn engine: streams the interviewer's reply, holds back the `<<<EVAL>>>` sentinel, persists the hidden per-answer score
- `app/api/curriculum/route.ts` / `app/api/study/[key]/route.ts` — global-cache-first generation: the first user pays one call, everyone after reads the cache
- `app/api/cron/knowledge/route.ts` — daily fresh-tech ingestion (HN + dev.to → one summarize call → `knowledge_items`)

## Feature map

**Prep hub** — generated scratch→expert curriculum, on-demand study materials, module quizzes, cheat-sheet cram mode, question bank.
**Practice** — spaced repetition (SM-2), daily drill, streaks.
**Interviews** — voice/text mock rounds (behavioral/technical/system-design/DSA/HR), **bar-raiser** and **panel** modes, **salary-negotiation sim**, **whiteboard round graded by AI vision**, **coding round** (Monaco + free Piston execution), hands-free walk mode, rescue-me hints.
**Personalization** — resume upload (client-side PDF parse) + skill profile, "roast my resume", STAR **story bank** the interviewer actually references, JD-tailored questions.
**Insights & retention** — skill radar, weakness heatmap, delivery-coaching trends, XP/levels/badges, shareable reports, PDF export, calendar (.ics) study plan, installable PWA with offline study pages + daily reminders.

Everything runs on free tiers. Generated content (curricula, study materials, quizzes, question bank) is cached globally so marginal AI cost per new user trends toward zero; only interviews consume per-user quota.

## Dev scripts

```bash
npx tsx scripts/verify-protocol.ts   # interview wire protocol (sentinel/eval)
npx tsx scripts/verify-wave1.ts      # streaks, analytics, schemas
npx tsx scripts/verify-wave2.ts      # SM-2, XP, ics, schemas
```
