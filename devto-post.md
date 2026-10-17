---
title: Pocket Oracle — a tarot reader that runs on open weights
description: How I shipped a paid-grade tarot reading on an open-weight model, why the fallback matters, and the latency numbers behind every reading.
tags: devchallenge, hf26challenge, ai, opensource
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

## What I Built

**Pocket Oracle** is a tarot reader you can carry in a browser tab — or install on your phone or your computer, because it's a PWA.

You choose a spread — one card, or Past / Present / Future — write the question you actually want to ask, and the app answers with a structured reading: a title, an opening, an interpretation of each card in its position, a closing, and practical guidance for reflection. Every reading can be **read aloud**, in a real narrator voice, and the whole thing installs as a PWA and works in English or Portuguese.

**Who would pay for it?** Someone who already sells readings. A tarot reader on Etsy, at a fair, or on a Friday-night call doesn't lack knowledge — they lack *time*. Writing up a spread into something a client would be happy to receive, and then recording it in your own voice, is the tedious part of a side hustle that otherwise works. Pocket Oracle turns a spread into a written reading, with optional audio narration. In production samples, responses took 12 to 72 seconds; the app allows up to 105 seconds before timing out. The reader stays in control: they choose the spread, the question, and whether to listen.

The second customer is the person I gave it to first — someone who wants to explore the deck without an account or newsletter. Browsing and drawing cards work locally in the browser. Only if they request an AI interpretation does the browser send the question and drawn card names to a Cloudflare Worker for processing by Workers AI; optional spoken narration sends the authorized reading text to ElevenLabs.

## Demo

Live, with a real certificate:

- **https://jrpasolini.tech** — the project's own `.tech` domain
- https://pocket-oracle-0saq.onrender.com — the Render deployment
- https://jrpasolini.github.io/pocket-oracle/ — the GitHub Pages copy

Pick three cards, ask something you actually care about, and press *Listen to your reading*.

## Code

The whole project is public: **https://github.com/jrpasolini/pocket-oracle**

- `cloudflare-worker.js` — the reading engine (prompt building, model cascade, validation, CORS allowlist, narration signing)
- `js/app.js` — the PWA front end
- `js/cards.js` / `js/cards.en.js` — the 78-card deck, in both languages

The deck's texts come from an earlier open project of mine (*Tarot Rider-Waite*), credited in the README. The card data is what was reused; everything around it — the engine, the cascade, the bilingual deck, the narration, the deployment — was built during the challenge window.

## How I Built It

The reader is **Gemma**, running as open weights on Cloudflare Workers AI — `@cf/google/gemma-4-26b-a4b-it` — with **Llama 3.3 70B** behind it as an explicit fallback.

The pipeline is deliberately boring. The Worker takes the drawn cards, builds a prompt that fixes the JSON shape we need, and validates the model's answer structurally before it is allowed to reach the app. Gemma is not on Cloudflare's JSON-mode list, so the schema is carried in the prompt and enforced afterwards; the fallback model can use the platform's native `json_schema`, which makes it a genuinely independent second opinion rather than a retry of the same call.

And here is the part I'd want to read in someone else's post, because I got it wrong first.

For a while, the app **advertised Gemma and delivered Llama**. The reading came back, users saw a reading, and only the response metadata showed that the open-weight model had never finished. The cause was boring and instructive: Gemma is a *reasoning* model, it spends real time thinking before it answers, and it was being cut off mid-thought by a per-attempt time slice that was too short — after which the fallback quietly answered for it.

So we measured instead of guessing. Six three-card readings, same payload, same conditions:

| reading | model that answered | time |
| --- | --- | --- |
| 1 | Gemma | 12.0 s |
| 2 | Gemma | 29.5 s |
| 3 | Gemma | 33.5 s |
| 4 | Gemma | 33.6 s |
| 5 | Gemma | 37.1 s |
| 6 | Llama (Gemma used its full slice) | 72.4 s |

Five of six answered by the open-weight model, median ≈ 33.5 s. The sixth is the interesting one: Gemma used all **60 seconds** it was given, failed honestly, and the fallback answered *inside the budget* instead of turning into a 502.

That number — 60 seconds for the primary, a 100-second total budget, a 105-second client ceiling — is the whole design. It is not a guess; it's what the measurements asked for. The app now delivers what it advertises, and when it can't, it says so by handing over to the backup rather than pretending.

Two more things worth mentioning: independent reviews and regression tests helped uncover and fix real issues, including the handling of AI quotas and stale PWA endpoints. Reviews reduce risk; they do not prove the system is flawless, and infrastructure checks remain ongoing. The **narration** is signed server-side, so the voice API key never reaches the client.

## Why Does Open Innovation Matter?

Three concrete reasons, in the order they bit me.

**1. Swapping the model is a line of code.** This project has already run on two models and moved between them in production without touching the product. Gemma is the reader; if a better open-weight model appears next month, it takes one array entry to try it. A closed API turns that into a migration.

**2. The economics of a side hustle.** A per-reading cost is the difference between a tool you can sell and a tool you can only demo. Open weights are what make the unit economics boring enough to price a reading. And when the model *does* need to think for forty seconds, that is a design constraint I can see and measure — not a queue I have to wait in.

**3. The deck outlives the app.** The card texts are open and credited, the code is public, and the engine is a single Worker. A reader who wants a different deck — Lenormand, an oracle deck, their own — can fork it. That's the part a closed product can't offer, and it's the reason the app is worth existing at all.

## My Agent Session

This project was built by **Antonio Pasolini** in collaboration with **Melissa**, an AI agent, and the post itself was drafted and reviewed the same way — disclosed rather than hidden. The measurement above exists *because* of that pairing: the agent kept testing production while I kept assuming it worked.
