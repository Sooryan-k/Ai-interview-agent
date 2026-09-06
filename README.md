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

## Every feature

This is the complete list, taken from the code. The in-app
[`/features`](app/features/page.tsx) page covers the headline ones in plain
language for signed-out visitors, each linking straight to where it lives —
it's a shop window, not an exhaustive index, so a few of the smaller in-round
helpers below only appear here.

### Learning path
| Feature | What it does |
|---|---|
| Scratch → expert roadmap | Pick a stack and where you're starting; generates levels → modules → topics, sequenced so each builds on the last |
| Study materials | Written notes per topic, generated once and cached globally — so re-reading costs nothing |
| Cheat sheets | A one-page skim per topic, for the hour before an interview |
| Checkpoint quizzes | Multiple-choice and short-answer checks after each module, with explanations |
| Cram mode | Every cheat sheet you've unlocked for a path, on one printable page |
| Question bank | Every question the app has ever asked, across all users — searchable, filterable by round type and difficulty, one click into your practice deck |
| Progress tracking | Per-topic todo / learning / mastered state, with level progress bars |
| Multiple stacks | Run several prep paths at once and switch between them |

### Interview rounds
| Round | What it does |
|---|---|
| Voice mock interview | Speaks questions aloud, listens to spoken answers, and adapts follow-ups to what you actually said. Typing always works too |
| **Repo round** | Reads a public GitHub repo you wrote — file tree, README, key source files — then asks why *you* built it that way |
| **Depth ladder** | One topic, a rung deeper every turn, stopping at your ceiling and naming the exact concept that stopped you |
| Whiteboard round | Draw a system design on a canvas; the AI grades the actual diagram via vision — components, bottlenecks, missing pieces, follow-up questions |
| Coding round | In-browser Monaco editor, Python or JavaScript, runs real test cases through the free Piston API, then reviews correctness, complexity and a cleaner approach |
| Salary negotiation sim | A recruiter with a hidden budget, in any of 10 currencies. Practise anchoring, countering, and not conceding first |
| Technical / behavioral / system design / DSA / HR | The standard round types, each with its own questioning style |
| Bar-raiser mode | An add-on that makes any round relentlessly demanding and strictly scored |
| Panel mode | Three interviewers (Priya, Arjun, Meera) rotate — each with their own avatar, name and **speaking voice** |
| Walk mode | Fully hands-free: it speaks, auto-listens, and auto-submits after a pause — for pacing around while you think |
| Level-scoped rounds | Launch an interview from a curriculum level so questions stay on what you've been studying |
| JD-tailored rounds | Paste a job description to steer the questions |

### While the round is running
| Feature | What it does |
|---|---|
| Rescue me (hint) | Nudges you toward the idea without giving it away, then re-asks the same question |
| Show me the answer | Teaches the answer in 2–3 sentences, highlighted in place, then moves on to the next question |
| Difficulty ramp | Easy and medium rounds open at "what is X" and climb one step at a time; hard opens at the senior bar |
| Voice controls | Mute/unmute, male or female interviewer voice with a preview, remembered per device |
| Question counter | 10 / 12 / 15 questions by difficulty, with a hard stop so a round always ends |
| End early | The interviewer signs off properly first, then you get the report |
| Resume mid-round | Close the tab and come back — transcript and progress are saved |
| Live transcript | Every question and answer on screen as it happens, with answers highlighted |

### After the round
| Feature | What it does |
|---|---|
| Report card | Overall score, strengths, weaknesses, and a model answer for every question |
| Delivery coaching | Filler words, **hedging language**, words per minute, long pauses and a **speech-clarity score** — all computed in the browser at zero AI cost |
| Skill radar | Average score per skill across all your interviews |
| Weakness heatmap | Skill × interview grid, weakest first, so you can see what isn't improving |
| Transcript replay | Re-listen to the whole interview, each panelist announced by name |
| Shareable report | A read-only public link — no login needed to view it |
| Print / PDF export | Print-tuned stylesheet on the report page |
| Restudy link | Jump from the report straight back into your roadmap |

### Practice & habit
| Feature | What it does |
|---|---|
| Spaced repetition | SM-2 scheduling — questions you missed resurface right before you'd forget them |
| Daily drill | One 60-second question a day to keep the habit alive |
| Streaks | Day counter that ignores a same-day revisit and resets on a gap |
| XP & levels | Earned from real actions: interviews completed, quizzes passed, topics mastered, cards reviewed, stories polished |
| Badges | Eight unlockables — First Round, Week Warrior, High Scorer, Quiz Master, Storyteller, The Grinder, Scholar, Veteran |
| Story bank | Your real experiences polished into STAR format; behavioral rounds reference and probe them directly |
| Study plan export | A two-week `.ics` calendar of study blocks for your unfinished topics |
| Daily reminders | Opt-in, once-a-day local browser nudge — no push service, no background tracking |
| Always current | A daily cron ingests Hacker News + dev.to so the interviewer knows about recent releases |

### Account & platform
| Feature | What it does |
|---|---|
| Free, no catch | No paywall, no card, no premium tier holding features back — the whole app runs on free infrastructure |
| Voice stays local | Speech recognition and synthesis both run on the browser's own APIs; audio is never uploaded or stored, only the transcribed text is scored |
| Passwordless auth | Magic link or Google OAuth — no passwords to store or leak |
| Usernames | Unique handle, collected through a one-time gate since passwordless signup has no form to put it on |
| Resume upload | Parsed in the browser, feeds a skill profile and tailors questions |
| "Roast my resume" | A blunt, funny critique with concrete fixes |
| Delete your data | Remove individual interviews (cascading to transcript and report) or whole prep paths from the dashboard |
| Dark / light theme | System-aware, with a manual toggle |
| Installable PWA | Add to home screen; already-visited study pages keep working offline |
| Responsive | Built and verified down to 390px |
| SEO | Generated favicon, home-screen icon, OG/Twitter share cards, `robots.txt` and `sitemap.xml` |

Everything runs on free tiers. Generated content (curricula, study materials, quizzes, question bank) is cached globally, so the marginal AI cost of a new user trends toward zero — they read caches the first user paid for. Interviews are the only genuinely per-user cost, and they're currently capped by the global budget alone.

## Dev scripts

```bash
npx tsx scripts/verify-protocol.ts   # interview wire protocol (sentinel/eval)
npx tsx scripts/verify-wave1.ts      # streaks, analytics, schemas
npx tsx scripts/verify-wave2.ts      # SM-2, XP, ics, schemas
npx tsx scripts/verify-wave3.ts      # delivery metrics, depth/repo prompts, repo URLs
```
