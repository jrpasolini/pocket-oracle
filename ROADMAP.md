# Roadmap — Pocket Oracle

Working document. These phases are mirrored in a Microsoft To Do list (**🔮 Pocket Oracle**) so we can both pick up exactly where we left off.

**Target:** Hacktoberfest 2026 · DEV Challenge **Week 2** — submissions close **18 October 2026, 23:59 PDT** (19 October, 03:59 BRT).

---

## Phase 0 — Foundation ✅ (2026-10-15)

- [x] Public repository created — dated proof that the project started inside the challenge window
- [x] English README with authorship and origin credit
- [x] GitHub Pages live
- [x] Worker with a model fallback chain (Gemma → Llama) + `wrangler.toml`

## Phase 1 — Engine (Gemma)

- [x] Deploy the Worker to Cloudflare — **v1.8.0** (`cdb356de`), deployed 2026-10-16
- [x] Measure Gemma's valid-JSON rate over ~10 readings — measured 6 three-card readings: **5/6 answered by Gemma**, median ≈ 33.5 s
- [ ] Add a self-repair retry (ask Gemma again before falling back)
- [x] Decide: Gemma-only, or keep the Llama safety net armed — **Gemma primary, Llama as an explicit fallback** (60 s slice, 100 s budget)
- [x] English prompt, English reading output

## Phase 2 — Voice (ElevenLabs)

- [x] Narration endpoint in the Worker (the API key stays server-side) — narration is signed server-side
- [x] "Listen to the reading" button; choose voice and model (`eleven_v4`)

## Phase 3 — Domain

- [x] `CNAME` so `jrpasolini.tech` serves the app — apex + `www` point to **Render** (DNS only); zone live
- [x] Enforce HTTPS — certificate issued 2026-10-16 (Google Trust Services, valid to 2027-01-14)

## Phase 4 — Bilingual (English default)

- [x] UI i18n layer with a PT/EN toggle, English as the default
- [x] Translate the 78-card dataset (~87k characters)

## Phase 5 — Audit

- [x] Write the audit brief
- [x] Run the independent audit (GPT-5.6 Sol) — 0 critical, 2 high, 6 medium, 1 low
- [x] Fix the findings **and** write real tests — an audit reduces risk, it does not prove correctness

## Phase 6 — Submission

- [x] DEV post in English, using the challenge template and the `#hf26challenge` tag — draft created (DEV id 4863834, `published: false`)
- [x] Set `ai_disclosure_level` on the post — `some_ai`
- [ ] Publish before the deadline

---

## Progress log

### 2026-10-16

- Worker was still serving an **18-second slice** build: the app advertised Gemma and delivered Llama. Deployed **v1.8.0** (Gemma 60 s slice, 100 s budget, 105 s client ceiling) after measuring Gemma's real completion times.
- Domain `jrpasolini.tech` live: nameservers moved to Cloudflare, apex + `www` pointed at Render, certificate issued.
- `js/app.js` client ceiling raised 75 s → 105 s; `wrangler.toml` now carries the production plain-text vars so a deploy cannot drop the CORS allowlist or the voice id.
- DEV submission drafted (id 4863834).

---

## Ground rules

- Everything here is **new work built between 2026-10-12 and 2026-10-18**. What comes from *Tarot Rider-Waite* is credited in the README.
- **Melissa (AI) is credited as co-author**, and the DEV post declares AI assistance.
- The independent audit is a review, not a proof. Tests are still required.
