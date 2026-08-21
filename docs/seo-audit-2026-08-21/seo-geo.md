# GEO Readiness Audit — cagongmap-nu.vercel.app

Audited 2026-08-21. Personal course MVP, single route (`/`), Korean-language, 9 curated cafes, map-first CSR product.

## GEO Health Score: **10 / 100**

| Dimension | Weight | Score | Contribution |
|---|---|---|---|
| Citability | 25% | 5/100 | 1.25 |
| Structural Readability | 20% | 10/100 | 2.0 |
| Multi-Modal Content | 15% | 20/100 | 3.0 |
| Authority & Brand Signals | 20% | 5/100 | 1.0 |
| Technical Accessibility | 20% | 15/100 | 3.0 |
| **Total** | | | **~10.25 → 10** |

This is not a "many small fixes" score — two structural facts drive nearly all of it: (1) the page ships **46 characters of pre-JS body text**, and (2) `<meta name="robots" content="noindex, nofollow">` is present site-wide. Both are deliberate, documented decisions (map-first CSR product; unverified photo rights), not bugs — the fixes below are framed accordingly.

---

## 1. AI Crawler Accessibility — the noindex / robots.txt asymmetry

**robots.txt** (verified):
```
User-Agent: *
Allow: /
```
No bot-specific rules — GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, CCBot, anthropic-ai, cohere-ai are all covered by the wildcard `Allow: /`. Confirmed by direct UA-spoofed fetch: `GPTBot` and `ClaudeBot` both get HTTP 200 with identical HTML — no cloaking, no bot-tier differentiation.

**Page-level meta**, same for every UA tested:
```html
<meta name="robots" content="noindex, nofollow"/>
```

This creates the asymmetry you flagged, and it plays out differently per engine:

| Engine | Grounding mechanism | Practical effect of `noindex` |
|---|---|---|
| **Google AI Overviews** | Pulled from Google Search's index | `noindex` removes the page from that index → **excluded**. High confidence. |
| **Bing Copilot** | Pulled from Bing's index | Same mechanism, same outcome → **excluded**. High confidence. |
| **ChatGPT (OAI-SearchBot)** | OpenAI's own search index, built specifically for the search/browsing feature | OpenAI documents that OAI-SearchBot respects standard indexing directives → **likely excluded**, though less publicly verified than Google/Bing. |
| **GPTBot / ClaudeBot (training crawlers)** | Bulk fetch for model training, not live indexing | `noindex` is an indexing signal, not a crawl-permission signal — these bots plausibly **still fetch and ingest** the bytes into training corpora, on whatever cadence that happens. Not a live-citation risk, but the page isn't actually "invisible" to them the way the noindex intent suggests. |
| **Perplexity** | Real-time fetch-and-summarize per query, not a persistent index in the same sense | Perplexity's crawler behavior has been publicly disputed (Cloudflare's 2025 disclosure alleged it doesn't reliably honor robots directives). A live, per-query fetch is not clearly gated by a page-level indexing meta tag the way an index-build step is → **the weakest point in the noindex barrier**. |

**Bottom line:** `noindex` reliably keeps this site out of the two engines that matter most for Korean local search (Google AIO, Bing Copilot). It's a soft, not hard, barrier against training ingestion and Perplexity-style live answering. Since raw pre-JS content is only 46 characters anyway (see §2), the practical citation risk today is near zero regardless — but that will change the moment textual content is added without revisiting the noindex decision.

**Do not treat "improve GEO" and "keep noindex" as compatible goals for Google/Bing.** The noindex was added specifically because the 9 photos have unverified usage rights (per `mvp-decisions.md` / CLAUDE.md — this is an explicit open item, not an oversight). Any GEO roadmap has to either (a) resolve photo rights and lift noindex, or (b) accept that Google AIO / Bing Copilot / ChatGPT search citation is out of scope until it does.

## 2. Passage Citability — there's almost nothing to cite

Raw pre-JS `<body>` text, stripped of scripts/tags:

```
WORK CAFE MAP 카공맵 오래 앉아 작업하기 좋은 카페 9곳 카페 제보하기
```

That's the entire extractable text surface — one `<h1>카공맵</h1>`, an eyebrow label, a count ("9곳"), and a CTA button label. Zero cafe names, zero addresses, zero amenity facts (콘센트/와이파이/소음), zero neighborhood terms in visible DOM text.

Notably, the data **does exist** in the HTTP response: `grep` on the raw HTML finds `work_fit`, `address`, `송파` (36 occurrences), etc. — but only inside React Server Components streaming payloads (`<script>self.__next_f.push(...)</script>`). That's JSON-shaped internal state, not prose. A boilerplate-stripped extractor (e.g. trafilatura, which this pipeline is supposed to score against) discards `<script>` contents entirely, so this data is functionally invisible to passage-level citation scoring — and even a crawler that does parse script JSON would surface field names and UUIDs, not a citable sentence.

For the target queries, here's what a citable passage would need to say, at the 134–167 word length that scores best:

- **"송파 카공 카페"** — needs a passage naming which of the 9 cafes are in 송파-dong-level areas, with a direct opening sentence: "송파에서 노트북 작업하기 좋은 카페는 나루터를 포함해 O곳입니다. 콘센트, 와이파이, 좌석 소음 수준을 기준으로 선별했습니다." followed by 2-3 sentences of concrete amenity facts per cafe.
- **"잠실 노트북 카페"** — same pattern, filtered to 잠실.
- **"콘센트 있는 카페"** — needs a passage that leads with the amenity, not the neighborhood: "콘센트가 있는 카페는 [목록]입니다" then per-cafe specifics (좌석 수, 혼잡도, 영업시간).

None of this exists today, even as hidden/secondary text. This is the single largest lever in the whole audit.

## 3. Structural Problem — the map is invisible to LLM crawlers

An interactive Kakao Map canvas + click-to-reveal detail panel has no DOM representation an LLM crawler can read — there's nothing to click, and per CLAUDE.md the cafe list only ever exists as props inside a client component tree, never rendered as a server-emitted list.

**Minimum fix that doesn't touch the map-first product:** `app/page.tsx` is already a server component that calls `getCafes()` with `revalidate = 300` — it has the data server-side today. It just needs to also **emit** that data as real server-rendered HTML somewhere in the initial response, not only pass it as a prop into the client bundle. Concretely:

- A `<section>` (can be visually secondary — a "목록으로 보기" collapsed/toggle view, or even just placed off-canvas with an accessible label, not `display:none`/`hidden` which some crawlers discount) containing one block per cafe: `<h3>{name}</h3>` + address + a short `<ul>` of amenities (콘센트, 와이파이, 소음, 좌석).
- This is additive — the map stays the primary UI. It's the difference between "9 cafes exist only as React props" and "9 cafes exist as bytes a non-JS-executing crawler can read."
- `GPTBot`/`ClaudeBot`/most AI crawlers do **not** execute JavaScript for the crawl step (this is the CSR-vs-SSR gap the framework is designed to catch) — Perplexity's live-fetch behavior is closer to a headless-render case in some reports, but that's the exception, not the baseline to design for.

Without this, no amount of prose-writing effort matters, because the prose has nowhere server-rendered to live.

## 4. llms.txt — evidence-based verdict: skip it for now

Checked: `https://cagongmap-nu.vercel.app/llms.txt` → **404**. No RSL 1.0 licensing declaration either.

Verdict, not oversold: as of current evidence, **no major AI platform (OpenAI, Anthropic, Perplexity, Google) has confirmed that its crawlers or answer engines actually consume `llms.txt` for grounding or citation decisions.** It's a voluntary community convention, unlike `robots.txt`, which crawlers demonstrably do parse. For this site specifically, adding one now would be close to pure signaling — there's no server-rendered content yet to point to, and the page is `noindex` anyway. If §3 gets built, a one-line `llms.txt` pointing at the new accessible list route is cheap enough to add afterward, but it should be **last** on the priority list, not first, and framed internally as low-confidence/low-cost rather than a real citability lever.

## 5. Brand Entity Signals — realistically, there are none, and that's fine

- Domain: `cagongmap-nu.vercel.app` — a Vercel preview-style subdomain, not a custom domain. Weak/no Domain Rating signal (the weakest-correlated signal anyway, ~0.266).
- No Wikipedia entity, no Reddit mentions, no YouTube presence, no LinkedIn page. No backlinks (single-person course project, not distributed anywhere).
- No authorship byline, no published dates, no external citations anywhere on the page.

This is expected and proportionate for a personal MVP built for a course, not a business. Chasing brand-mention correlation (YouTube ~0.737, Reddit "high") right now would be effort badly mismatched to the project's actual goal (학습, not 사업화 — per CLAUDE.md). Flagging it for completeness, but it does not belong in the top-5 action list below. If this project is ever made public/real, the single highest-leverage move per the correlation table would be one short, authentic video touring a couple of the cafes — but that's a future-state note, not a now-action.

---

## Platform-Specific Scores

| Platform | Score | Why |
|---|---|---|
| Google AI Overviews | 0/100 | `noindex` excludes from Google Search index outright |
| Bing Copilot | 0/100 | `noindex` excludes from Bing index outright |
| ChatGPT (search/browsing) | ~2/100 | OAI-SearchBot likely respects the same indexing signal; even if not, no citable prose exists to surface |
| Perplexity | ~8/100 | Real-time fetch behavior may not strictly honor `noindex`, and robots.txt allows the fetch — but there is still nothing citable in the raw HTML today, so the gap is theoretical, not actual |

---

## Top 5 Highest-Impact Changes

1. **[High impact / Medium effort] Decide the noindex trade-off explicitly, before investing in content.** You cannot be cited by Google AIO or Bing Copilot while `noindex, nofollow` stands — full stop, regardless of any content work below. This is a policy decision (photo rights), not an SEO task: either resolve the photo-rights item already tracked as open in `mvp-decisions.md` and lift `robots: { index: false }` in `layout.tsx`, or consciously accept Google/Bing/ChatGPT-search citation is out of scope for now. Doing #2–#4 without this only benefits the Perplexity-style live-fetch edge case.

2. **[High impact / Medium effort] Server-render a real text surface for the 9 cafes.** `app/page.tsx` already fetches via `getCafes()` server-side (`revalidate = 300`) — extend it to emit a semantic HTML block (name / address / amenities per cafe), not just pass data as client props buried in the RSC script payload. This is the one change that turns "46 characters of body text" into something an AI crawler can actually parse, without changing the map-first UI (can be a secondary/toggle view).

3. **[Medium impact / Small effort] Write 3 direct-answer passages (134–167 words) matching the target Korean query clusters** — "송파 카공 카페", "잠실 노트북 카페", "콘센트 있는 카페" — each leading with a direct answer in the first 40–60 words, feeding into the block from #2.

4. **[Medium impact / Small effort] Add JSON-LD `ItemList` of `CafeOrCoffeeShop`/`LocalBusiness` entities** (name, address, `amenityFeature` for 콘센트/와이파이, `dateModified` from `last_verified`). Cheap since every field already exists in the `places` table; won't help while `noindex` stands, but removes a dependency for the day it's lifted.

5. **[Low impact / Small effort, do last] Add `/llms.txt`** only after #2–#4 exist and only pointing at real content — evidence for major-platform adoption is thin, so treat this as a cheap afterthought, not a priority.

---

## Notes on method

- Fetched `robots.txt`, `/llms.txt` (404), `/sitemap.xml` (404), and the homepage both with a default UA and with `GPTBot`/`ClaudeBot` UAs — identical `noindex, nofollow` response in all cases (no cloaking).
- Inspected raw pre-JS HTML (`curl`, no Playwright render) to isolate what a non-JS-executing crawler actually receives: only 46 characters of visible body text, despite ~36 occurrences of `송파` and full per-cafe field data (`address`, `work_fit`) present but locked inside `<script>` RSC payload JSON, not DOM text.
- No JSON-LD (`application/ld+json`) found anywhere on the page.
