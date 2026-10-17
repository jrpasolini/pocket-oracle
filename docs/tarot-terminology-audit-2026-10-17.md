# Rider–Waite bilingual terminology audit — 2026-10-17

**Branch:** `feat/accessibility-and-model-credits`
**Scope:** `js/cards.js`, `js/cards.en.js`, frontend rendering, canonical card metadata in `cloudflare-worker.js`, and AI instruction templates.

## Verified vocabulary

| Portuguese suit | English suit | Element | Cards |
| --- | --- | --- | ---: |
| Paus | Wands | Fogo / Fire | 14 |
| Copas | Cups | Água / Water | 14 |
| Espadas | Swords | Ar / Air | 14 |
| Ouros | Pentacles | Terra / Earth | 14 |
| Arcanos Maiores | Major Arcana | varies | 22 |

The names, suit fields, ranks, image paths and canonical Worker metadata match for all 78 cards in both languages.

### "Xícaras" versus "Copas"

The expressions `xícara` and `xícaras` **did not occur** in the original static PT/EN deck or in the original canonical Worker card records. The source of a previously observed label "xícaras" could therefore be an AI-generated interpretation or automatic browser translation, not a stored suit label; without the precise screenshot/request we cannot determine which happened.

The proper Portuguese name of the suit in this project's naming convention is **Copas**. English **Cups** is the standard English name. In descriptions of Rider–Waite card illustrations, **taça(s)** is a valid name for the actual illustrated vessel, and should **not** be replaced with `Copas` indiscriminately. Similarly, `pentáculo(s)` can describe the actual symbols pictured on a card belonging to the **Ouros / Pentacles** suit.

## Changes made

1. Corrected grammatical agreement in the Portuguese Nine of Cups description, from "O Nove de Copas é conhecida" to "O Nove de Copas é conhecido"; synchronized its canonical Worker description.
2. Refined the Portuguese and English AI system prompts to prefer the canonical suit names in generated interpretation text, and disallow literal misnomers such as `xícaras` as suit names. This prompt change affects live interpretation **only if and when the updated Worker is deployed**; it is not in production simply because it was committed to GitHub.
3. Added `translate="no"` to card-name and suit-label UI elements (gallery, details, filtering and card names within interpretations), preventing automatic browser translation from altering terminology that is already localized by the app's PT/EN selector.
4. Added `tests/tarot-terminology.test.mjs` to assert all 78 localized names, ranks, suit-to-element mappings and concordance with Worker canonical metadata.
5. Bumped the PWA cache version so changed frontend assets do not remain cached on already installed clients.

## Important limits

Prompt guidance reduces terminology errors; it does **not** guarantee every free-form AI paragraph is flawless. For a future release, compare several real AI interpretations across languages and card spreads, including fallback to Llama, and review unusual terms manually.

This audit does not claim a tarot-practitioner editorial review of all symbolic claims in the full descriptive material. The existing professional user feedback is encouraging, but is not a full validation of 78 card descriptions.

**Deployment status:** No merge into `main` and no Worker deployment occurred as part of this audit.
