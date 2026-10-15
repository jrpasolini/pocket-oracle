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

- [ ] Deploy the Worker to Cloudflare
- [ ] Measure Gemma's valid-JSON rate over ~10 readings
- [ ] Add a self-repair retry (ask Gemma again before falling back)
- [ ] Decide: Gemma-only, or keep the Llama safety net armed
- [ ] English prompt, English reading output

## Phase 2 — Voice (ElevenLabs)

- [ ] Narration endpoint in the Worker (the API key stays server-side)
- [ ] "Listen to the reading" button; choose voice and model (`eleven_v4`)

## Phase 3 — Domain

- [ ] `CNAME` in the repo + DNS so `jrpasolini.tech` serves GitHub Pages
- [ ] Enforce HTTPS

## Phase 4 — Bilingual (English default)

- [ ] UI i18n layer with a PT/EN toggle, English as the default
- [ ] Translate the 78-card dataset (~87k characters)

## Phase 5 — Audit

- [ ] Write the audit brief
- [ ] Run the independent audit (GPT-5.6 Sol)
- [ ] Fix the findings **and** write real tests — an audit reduces risk, it does not prove correctness

## Phase 6 — Submission

- [ ] DEV post in English, using the challenge template and the `#hf26challenge` tag
- [ ] Set `ai_disclosure_level` on the post
- [ ] Publish before the deadline

---

## Ground rules

- Everything here is **new work built between 2026-10-12 and 2026-10-18**. What comes from *Tarot Rider-Waite* is credited in the README.
- **Melissa (AI) is credited as co-author**, and the DEV post declares AI assistance.
- The independent audit is a review, not a proof. Tests are still required.
