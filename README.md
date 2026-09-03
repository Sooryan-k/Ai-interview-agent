# dryrun AI — Interview Agent

Sign in, pick your stack, and the agent prepares **everything** for your interviews:

- 🗺️ **Scratch → Expert roadmap** — a full curriculum (levels → modules → topics) generated for your stack
- 📚 **Study materials on demand** — explanations, annotated code, cheat sheets, curated free resources and likely interview questions per topic
- 🎙️ **Voice mock interviews** — a realistic AI interviewer (Web Speech API: free, in-browser STT + TTS) that asks follow-ups and privately scores every answer
- 🧑‍💻 **Interviewed on your own code** — point it at a public GitHub repo and it asks why *you* built it that way
- 🪜 **Depth ladder** — one topic drilled deeper every rung until it finds, and names, your knowledge ceiling
- 📊 **Report cards** — overall score, per-question model answers, strengths/weaknesses, delivery metrics (filler words, hedging, WPM, pauses, speech clarity) and restudy links
- 📰 **Always current** — a daily cron ingests Hacker News + dev.to so the interviewer knows about last week's releases

**Runs 100% on free tiers**: Gemini free API, Supabase free tier, Vercel Hobby.

## Setup (~10 minutes)

### 1. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run **each** migration in order:
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), then
   [`supabase/migrations/0002_stories.sql`](supabase/migrations/0002_stories.sql), then
   [`supabase/migrations/0003_username.sql`](supabase/migrations/0003_username.sql).
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

**Optional — `GITHUB_TOKEN`:** the repo-interview round reads public repos through
GitHub's API. Unauthenticated that's 60 requests/hour *per IP*, shared across
serverless instances, so it runs out quickly in production. A classic token with
**no scopes** (public data only) raises it to 5,000/hour. The feature works
without it; it just rate-limits sooner.

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
| Gemini (`turn` tier) | ~15 RPM / ~1k req/day | **1 call per interview turn** — question + hidden scoring come back in one response |
| Gemini (`smart` tier) | same | Curriculum generation (once per stack, shared by every user) and end-of-interview reports. **Both tiers default to Flash-Lite**: Flash is frequently 503-overloaded on the free tier, so `GEMINI_SMART_MODEL` is the opt-in upgrade once you have headroom |
| Supabase | 500 MB, pauses when idle | Text-only rows; 30-day knowledge pruning; the daily cron write is the keep-alive |
| Vercel Hobby | daily crons, 100 GB | One cron; streaming routes set `maxDuration: 60` |
| Voice | — | Web Speech API is fully client-side and free (best in Chrome/Edge; text always works) |
| GitHub API | 60 req/hr per IP | Repo digests are assembled without any AI call; set `GITHUB_TOKEN` for 5,000/hr |

**Budget maths worth knowing before you share the link.** A round is 10 (easy) / 12 (medium) / 15 (hard) questions, and every question plus the final report is one call — so a hard round costs ~16 of the 800 daily calls. With the per-user interview cap disabled (below), a handful of enthusiastic sessions can consume the day's budget, so `GLOBAL_DAILY_CALL_CAP` is the dial to watch.

Quota guards (`daily_usage` table, atomic counter) cap global calls/day. The **per-user interviews/day cap is currently disabled** (`CAPS.userInterviews` in [`lib/quota.ts`](lib/quota.ts) returns 0 = unlimited, so `USER_DAILY_INTERVIEW_CAP` is ignored); flip it back there if one account starts eating the global budget. When the budget is spent the app degrades to **Practice Mode** — all cached curricula, lessons and quizzes stay available. Never a hard outage.

## Architecture notes

- `lib/gemini.ts` — every AI call flows through here (model tiering, backoff, mock mode)
- `app/api/interview/[id]/turn/route.ts` — the turn engine: streams the interviewer's reply, holds back the `<<<EVAL>>>` sentinel, persists the hidden per-answer score
- `app/api/curriculum/route.ts` / `app/api/study/[key]/route.ts` — global-cache-first generation: the first user pays one call, everyone after reads the cache
- `app/api/cron/knowledge/route.ts` — daily fresh-tech ingestion (HN + dev.to → one summarize call → `knowledge_items`)
- `lib/prompts/interviewer.ts` — one builder for every round type, plus the per-turn variants (hint / show-the-answer / sign-off). The turn route hard-stops a round once its planned questions are used up rather than trusting the model to count
- `lib/github.ts` — builds the repo digest deterministically (tree + README + highest-signal files), so the repo round adds **zero** AI cost beyond its turns
- `lib/panel.ts` — parses the `[Name]` speaker tag out of panel messages: it becomes the avatar and picks the voice, and is never read aloud
- `lib/speech/delivery.ts` — filler/hedge counting and the clarity score, all pure functions with no AI call
- `lib/schemas.ts` — Zod schemas **and** the wire protocol: the `<<<EVAL>>>` sentinel, the end marker, and the `<ANS>` tags that highlight a revealed answer (with repair for malformed variants)
- SEO/branding: `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx` and `app/twitter-image.tsx` generate the favicon, home-screen icon and social-share cards from code (via `next/og`) instead of static image files, so they always match the brand mark. `app/robots.ts` and `app/sitemap.ts` generate `/robots.txt` and `/sitemap.xml`. All four (plus `metadataBase` in `app/layout.tsx`) hardcode a `SITE_URL` constant — update it if you move off `dryrunai.vercel.app` to a custom domain.

## Feature map

**Prep hub** — generated scratch→expert curriculum, on-demand study materials, module quizzes, cheat-sheet cram mode, question bank.
**Practice** — spaced repetition (SM-2), daily drill, streaks.
**Interviews** — voice/text mock rounds (behavioral/technical/system-design/DSA/HR), **repo round** (interviews you on a public GitHub repo you wrote), **depth ladder** (one topic drilled until it finds your knowledge ceiling), **bar-raiser** and **panel** modes, **salary-negotiation sim** with currency choice, **whiteboard round graded by AI vision**, **coding round** (Monaco + free Piston execution), hands-free walk mode.
**In-round help** — *rescue me* hints that nudge without giving it away, and *show me the answer*, which teaches the answer in two or three sentences (highlighted in place), then carries on with the next question. Easy and medium rounds ramp from fundamentals upward rather than opening at senior level; hard opens at the bar and stays there.
**Panel rounds** — three interviewers (Priya, Arjun, Meera) take turns, each shown with their own avatar and name beside the message, and each speaking in their own voice.
**Personalization** — resume upload (client-side PDF parse) + skill profile, "roast my resume", STAR **story bank** the interviewer actually references, JD-tailored questions.
**Insights & retention** — skill radar, weakness heatmap, delivery-coaching trends (filler words, **hedging language**, pace, pauses, **speech-clarity score**), XP/levels/badges, shareable reports, PDF export, calendar (.ics) study plan, installable PWA with offline study pages + daily reminders.

A public `/features` page explains every one of the above in plain language, with each entry linking straight to where it lives in the app.

Everything runs on free tiers. Generated content (curricula, study materials, quizzes, question bank) is cached globally, so the marginal AI cost of a new user trends toward zero — they read caches the first user paid for. Interviews are the only genuinely per-user cost, and they're currently capped by the global budget alone.

## Dev scripts

```bash
npx tsx scripts/verify-protocol.ts   # interview wire protocol (sentinel/eval)
npx tsx scripts/verify-wave1.ts      # streaks, analytics, schemas
npx tsx scripts/verify-wave2.ts      # SM-2, XP, ics, schemas
npx tsx scripts/verify-wave3.ts      # delivery metrics, depth/repo prompts, repo URLs
```
