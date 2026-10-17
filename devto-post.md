---
title: I Built an Open-Weight Tarot Reader — Then Found My Backup Model Was Doing the Work
description: A side-hustle experiment with Gemma 4, Cloudflare Workers AI, ElevenLabs, accessibility improvements, honest user feedback, and a fallback that hid the real bug.
tags: devchallenge, hf26challenge, ai, opensource
---

*This is my submission for the [Hacktoberfest Open-Source AI Challenge — Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12).*

**The application worked. The readings sounded convincing. And the wrong model was doing most of the work.**

That was the uncomfortable discovery I made while building **Pocket Oracle**, an open-weight AI-powered tarot reader. The app appeared healthy: it accepted questions, interpreted the cards, and returned nicely structured answers. But a fallback model was quietly rescuing a primary model that I had not given enough time to finish.

Fixing that taught me more about shipping a useful AI product than getting the first reading to work. It also led to two other lessons: accessibility is much more than adding audio, and a potential customer who isn't sure she would pay can be as valuable as one who says she might.

## What I Built

**[Pocket Oracle](https://jrpasolini.tech/)** is an installable, bilingual Rider–Waite tarot grimoire with an AI-assisted reading workflow.

The browser experience includes the complete **78-card deck**, searchable card meanings and symbolism, individual correspondences, and one-card or three-card **Past / Present / Future** spreads. After drawing, a visitor can ask a question and request a structured interpretation from an open-weight language model. An optional ElevenLabs action narrates the generated reading.

I also added a persistent **Sun/Moon appearance toggle**, clearer keyboard focus and navigation, improved contrast, and a **Read aloud** button that hands selected card content to the browser's built-in speech engine. The interface and card database are available in **English and Brazilian Portuguese**.

The deck, exploration tools, and card draws work offline once cached by the PWA. **AI interpretation and ElevenLabs narration require a network connection.** There is no account requirement or checkout.

### The side-hustle hypothesis

My first target customer is **the independent tarot reader** who already understands the cards but spends time turning a live session into a clear, well-presented explanation for a client—especially a beginner.

Structured drafts and optional narrated readings could help a practitioner deliver a more polished experience without inventing the interpretation from scratch every time. That might eventually justify a per-reading fee, a branded report, or a small subscription.

These are still **hypotheses**. Pocket Oracle has no payment system, no paying customers, and no validated price point. The purpose of this version was to build a working tool and get honest feedback before pretending to have a business.

## Demo

**[Try Pocket Oracle on jrpasolini.tech](https://jrpasolini.tech/)**

Alternative front-end deployments: [Render](https://pocket-oracle-0saq.onrender.com/) · [GitHub Pages](https://jrpasolini.github.io/pocket-oracle/)

To try the complete experience:

1. Open the app and choose English or Portuguese.
2. Explore the 78 cards or draw a one-card or three-card spread.
3. Enter a question and select **Interpret this spread with AI**.
4. Optionally select **Listen to your reading**.
5. Try the Sun/Moon theme and the separate **Read aloud** button on a card detail page.

An AI reading may take **30–100 seconds**, depending on inference and fallback. The optional paid speech service is invoked only when the visitor requests it.

## Code

**[Source code — jrpasolini/pocket-oracle](https://github.com/jrpasolini/pocket-oracle)**

I started the new Pocket Oracle repository and application on **October 15, 2026**, within the Week 2 challenge window. It is based on ideas and reused tarot content from my older [Tarot Rider-Waite project](https://github.com/jrpasolini/Tarot-Rider-Waite). I have credited that source rather than pretending all 78 card descriptions were written from scratch this week. The new AI workflow, bilingual application integration, model cascade, validation, protected narration, security hardening, accessibility improvements, and tests were developed for this challenge. The repository documents the applicable [license](https://github.com/jrpasolini/pocket-oracle/blob/main/LICENSE) and [third-party notices](https://github.com/jrpasolini/pocket-oracle/blob/main/NOTICE).

## How I Built It

### 1. Keep the interface small; place the trust boundary on the server

I deliberately used plain HTML, CSS, JavaScript, and a service worker rather than introducing a frontend framework. A **Cloudflare Worker** at `api.jrpasolini.tech` owns the AI integration.

```text
Browser / installable PWA
  served from jrpasolini.tech (.tech domain) via Render
  GitHub Pages mirror available
  | question + card names + spread + interface language
  v
Cloudflare Worker: POST /interpretar
  | validate input, look up canonical card data
  | construct prompt and request structured output
  v
Gemma 4 26B A4B (preferred, open-weight)
  | on eligible failure -> Llama 3.3 70B (fallback)
  v
Validate JSON + restore trusted card identities
  | return interpretation and actual model metadata
  v
Browser renders the reading
  |
  +-- optional narration click
       -> short-lived signed authorization
       -> Cloudflare Worker: POST /narrar
       -> ElevenLabs -> audio
```

The public front end is a static site served from `jrpasolini.tech` through **Render**, with a **GitHub Pages** mirror; the Worker is the only server-side component. The browser sends card **names**, not authoritative card meanings. The Worker resolves them against its own canonical 78-card dataset. That prevents a modified browser payload from quietly replacing reference descriptions used in the model prompt.

The interpretation response follows a defined JSON structure: title, opening, card interpretation, answer, guidance, and a synthesis for three-card spreads. Invalid or inconsistent output is rejected; the selected cards and positions are restored from validated data, not blindly trusted from the model's prose.

The original question is not intentionally stored in an application database. However, this is **not local or zero-retention AI**: question data goes to Cloudflare Workers AI, and authorized reading text goes to ElevenLabs if narration is requested. Provider data-handling policies still apply.

### 2. The fallback bug: a successful response concealed a failed assumption

I chose **Gemma 4 26B A4B** (`@cf/google/gemma-4-26b-a4b-it`) as the primary model on Cloudflare Workers AI, with **Llama 3.3 70B** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) as backup.

At first, I gave each attempt too little time. Gemma frequently exceeded that short window, so the system invoked Llama. The app returned a plausible interpretation and looked successful, but the model I was testing was barely getting an opportunity to finish.

**A successful HTTP response is not evidence that your intended model succeeded.**

I exposed and inspected the model metadata, then reworked the time budget. Gemma now has up to **60 seconds per attempt**, within a **100-second total Worker budget**; the frontend has a **105-second request ceiling**. Eligible failures can still fall back to Llama.

Here are six recorded three-card development runs under the same input and test conditions:

| Run | Model that delivered the reading | End-to-end time |
| --- | --- | ---: |
| 1 | Gemma | 12.0 s |
| 2 | Gemma | 29.5 s |
| 3 | Gemma | 33.5 s |
| 4 | Gemma | 33.6 s |
| 5 | Gemma | 37.1 s |
| 6 | Llama after Gemma timed out | 72.4 s |

Gemma completed **five of six requests** in this small test, with a **33.55-second median across all six**. The sixth reading demonstrated why a genuine fallback still matters: Gemma exhausted its attempt window, and Llama returned a result within the overall budget.

This is an **operational sample, not a general benchmark**. The timeout also limits how long the application waits; it does not necessarily cancel inference already running remotely. That matters when evaluating actual cloud costs.

### 3. A reliable AI feature needs observable failures

I learned to treat failures as explicit product behavior rather than burying them behind a retry.

The Worker distinguishes response-validation errors, per-attempt timeouts, transient provider failures, and exhausted account quota. A temporary capacity problem can justify trying the fallback. An account-wide daily quota failure (`3036`), on the other hand, returns **HTTP 429** without pointlessly retrying another model under the same exhausted account.

The code uses a prompt-level JSON instruction for Gemma and the supported schema-format option for the Llama fallback, followed by application-side validation in both cases. The frontend reports **which model actually generated the displayed interpretation**.

A separate AI-assisted security audit during development identified **two high-severity and six medium-severity findings**. We addressed those findings and added regression coverage. Two important decisions were keeping ElevenLabs credentials off the client and resolving tarot metadata on the Worker rather than trusting user-editable descriptions.

An audit and passing tests reduce risk; they do not establish that a live site is vulnerability-free. The [test suite](https://github.com/jrpasolini/pocket-oracle/tree/main/tests), [deployment notes](https://github.com/jrpasolini/pocket-oracle/blob/main/DEPLOY.md), and commit history make the decisions inspectable.

### 4. ElevenLabs: make paid generation an intentional action

ElevenLabs provides the optional spoken interpretation using the `eleven_v4` speech model. API credentials remain on the server.

Once an interpretation has been accepted, the Worker can issue a short-lived **HMAC-signed narration authorization**. The browser presents it when the visitor clicks the narration action. That constrains which reading may be sent for paid speech generation; it does not let the caller freely submit arbitrary speech text.

The authorization expires after **ten minutes**, but can be reused before expiry. Therefore signing alone is not enough: rate limits, account quotas, and expenditure monitoring still matter.

A nuance surfaced during multilingual testing: our Worker currently sends ElevenLabs a `language_code` derived from the **English/Portuguese interface setting**, not from automatic detection of the generated paragraph's language. The model's multilingual abilities do not, by themselves, guarantee the correct narration pronunciation in every cross-language combination.

### 5. Accessibility changed the definition of “finished”

Initially, I thought adding narrated readings would be the biggest accessibility improvement. Then routine visual tests exposed problems that a working API could never reveal.

In dark mode, some **Past / Present / Future** labels and card captions lacked sufficient contrast. The language selector retained its light-theme background. The three-card action looked inactive even though it was clickable.

I corrected these inconsistencies, made active and genuinely disabled states visually distinct, and added automated regression checks for relevant color contrasts.

The resulting accessibility work includes:

- Persistent **Sun/Moon themes**, with more consistent contrast and focus indicators.
- A **skip-to-content** link and improved keyboard interaction.
- A **Read aloud** button that uses the browser's built-in speech engine for card content, separate from the optional paid ElevenLabs narration.
- Localized, readable controls, including the Portuguese/English selector.

The browser speech feature depends on available operating-system voices; its quality and offline availability vary. And these changes are **not a WCAG certification** or proof that someone using a screen reader can complete every flow independently. That still requires direct assistive-technology testing.

A later hands-on evaluation from a person with **low vision** brought that limitation into focus: despite the visual fixes and the automated contrast checks, she still found some pale text unreadable even when magnified considerably. That is **an unresolved usability finding**, not something I can dismiss because other controls passed a contrast test.

### 6. One apparent language bug was actually useful behavior

Another late-stage test showed an English interface displaying an AI interpretation written in Portuguese. My first instinct was to “fix” it. But the visitor had **asked the question in Portuguese**.

Further manual tests revealed a useful pattern: English and Portuguese questions could receive answers in the question's language, even when the interface was set to the other language. With a Spanish question, the response came back in the interface language.

That distinction matters: **interface locale, question language, and model-output language are not always the same thing.**

I reverted a proposed strict-language validation rule. It would have rejected potentially useful readings simply because their language differed from the interface, potentially triggering unnecessary fallback calls. The stable product remains **bilingual**, not advertised as a universal multilingual service. Expanding language handling can wait until after the contest.

## Why Does Open Innovation Matter?

Because I want the **reading model to be a replaceable component**, not a dependency that defines the whole business.

**Model choice.** Gemma's open weights give developers more potential deployment options than a product tied exclusively to one closed inference API. I use Cloudflare Workers AI today, not local inference. Another runtime would still require new validation of prompting, latency, JSON behavior, pricing, and safety. Being able to swap or compare models without renegotiating a single vendor contract matters if cost per reading ever becomes a real constraint.

**Inspectability and adaptation.** The application logic, tests, and integration are public. A developer can see how prompts are built, how fallback is decided, and how output is validated. The project credits reused work and distinguishes the MIT-licensed original code from third-party components and card artwork subject to their own terms.

**Economics without wishful thinking.** Open weights do **not** mean zero operating cost. Cloudflare inference, ElevenLabs narration, and hosting still need budgets. A future paid version would have to measure cost per completed reading, not just model-token price, and demonstrate value beyond a general AI chat.

**Honest boundaries.** Cloudflare operates the hosted AI runtime and ElevenLabs is a commercial service. I am not claiming Pocket Oracle runs its complete AI stack locally, or that every part of the production system is open source.

For a side hustle, that honesty matters as much as the technology choice.

## Early User Feedback

I asked early users to try the application and comment on usability, accessibility, and whether they might pay. These impressions are **qualitative, anonymized, and shared with the participants’ permission**; they are not a representative market survey or formal accessibility audit.

A **professional tarot reader** described the app as smooth and found the language of its interpretations understandable. One point stood out from her Portuguese feedback (translated into English):

> “It helps explain the meanings more clearly to people who are new to tarot.”

She also said she would consider paying, particularly for the “reading” feature. That word was not specific enough to treat as a purchase commitment or a definite endorsement of paid audio. Still, her feedback sharpened the target customer: a working reader who might use the tool to communicate with beginners.

A **second, nonprofessional tester** had a more challenging reaction. She suggested **asking questions by voice**, comparing the interaction to a conversational AI assistant, and wondered how a blind user would operate a flow that still required typing and clicking. She also was **unsure she would pay in its present form**, especially with free alternatives such as Gemini available.

A **third tester with low vision** explored the app herself. She liked the language selector and the available spoken-reading controls, and used her **phone keyboard's dictation feature** to enter text—a device feature, not built-in voice input in Pocket Oracle. But she also had to enlarge some pale text substantially and still could not read it. As a first-time tarot user, she found parts of the card explanations difficult to follow. Initially she missed another reading/audio option; after I directed her to it, she described the voice quality and explanation as much clearer. She also wondered whether installing the app meant the AI automatically knew her personal details, highlighting the need for plain-language privacy explanations.

These observations make three product questions impossible to ignore:

1. **Accessible participation:** Can a person with low vision read every essential control and finish a session without help? Audio output alone does not answer that question.
2. **First-time-user clarity:** Can someone unfamiliar with tarot understand the reading without having to guess what the terminology or controls mean?
3. **Commercial differentiation:** What makes a specialized tarot workflow worth paying for when general-purpose AI assistants are freely available?

None of these questions is solved by calling the product “AI-powered.” The opportunity, if it exists, lies in **domain-specific workflow, consistency, presentation, and professional usefulness**—not in charging people for access to a generic text box.

No one has paid for Pocket Oracle. I have not measured a trustworthy conversion rate or selected a viable price. Those are next-stage experiments, informed by actual feedback rather than invented traction.

## My Agent Session

I built Pocket Oracle with help from **Melissa**, an AI agent, and used additional AI-assisted review to challenge implementation assumptions. I made the product, scope, and deployment decisions; Melissa helped implement, investigate failures, write tests, and document the system.

The model-attribution incident is the clearest example of why that process was useful. We did not stop at “the feature works”; we asked *which model worked, why the other model didn't, and what the failure cost us*.

Development history, test files, and deployment notes are linked from the [GitHub repository](https://github.com/jrpasolini/pocket-oracle). I did not publish a DevRelay agent-session recording and make no claim that one exists.

The accessibility changes were ultimately [squash-merged into `main`](https://github.com/jrpasolini/pocket-oracle/pull/6) on October 17. The [post-merge regression checks](https://github.com/jrpasolini/pocket-oracle/actions/runs/39057159336) and [GitHub Pages build](https://github.com/jrpasolini/pocket-oracle/actions/runs/39057159236) succeeded. Cloudflare Worker deployments are managed separately, so a repository merge should not be mistaken for proof that every live backend configuration has been synchronized. Before publication, the deployed Worker was checked against the final commit and synchronized.

## Prize Categories

I am submitting Pocket Oracle for the following **Week 2 partner categories**, each connected to technology actually used:

- **Best Use of Gemma** — Gemma 4 26B A4B is the preferred model driving the core reading workflow, with measured responses, output validation, and observable fallback.
- **Best Use of ElevenLabs** — opt-in reading narration, protected behind a server-side API and signed authorization.
- **Best Use of Render** — an alternate deployed frontend for the app.
- **Best Use of a .tech Domain** — [jrpasolini.tech](https://jrpasolini.tech/) is the project's public custom domain, registered using the Hacktoberfest first-year promotional offer.

The project also enters the overall **Week 2: Side Hustle** challenge.

## What Comes Next

The prototype answered its first technical question: **yes, Gemma can power a structured Rider–Waite reading**. It also uncovered a harder one: **can this become a workflow a professional would choose over a free general-purpose assistant?**

The next iteration should test that proposition through direct usability work, especially with people who rely on assistive technology, and through real measurements of cost and willingness to pay. Voice input, clearer beginner guidance, a renewed audit of text contrast and discoverability, and richer multilingual narration are possibilities—not features I am claiming to have shipped.

For the challenge, I chose to stop adding functionality, keep the working implementation stable, and document both the improvements and the limits.

**The best thing this project produced was not a tarot prediction. It was a better way to ask whether an AI feature actually works—and whether anyone needs it enough to pay for it.**
