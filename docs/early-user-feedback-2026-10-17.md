# Pocket Oracle — Early User Feedback (17 October 2026)

**Stage:** qualitative discovery during the Hacktoberfest 2026 challenge. **Sample:** three individuals (one professional tarot reader, one general user, one participant with low vision). This is **not** a representative survey, accessibility audit, or proof of paid demand.

**Consent and privacy:** Consent for anonymized use was confirmed by the project owner for the three participants. Participant names, telephone numbers, personal questions and message headers are intentionally omitted. Original comments were in Portuguese; English renderings for an article should be marked as translations. The conversations are kept by the project owner, not reproduced in full here.

## Participant A — Professional tarot reader

- App experience: "O app é fluido e fiel aos significados das cartas, as leituras são interessantes, tem uma linguagem fácil de entender."
- Interpretation: "Os significados são fiéis,a leitura com a IA é de fácil entendimento."
- Professional usefulness: "Ajuda a explicar melhor os significados para pessoas leigas."
- Opinion about audio accessibility: "Sim muito bom, e facilita para melhorar o acesso."
- Would consider paying: "Sim, principalmente a função da leitura."
- Permission for anonymous quotation: "Pode usar sim ."

**Interpretation:** She saw value for practitioners explaining card meanings to beginners, not just automating content production. Her reference to "leitura" is ambiguous between a reading and audio narration; **do not claim she specifically preferred the ElevenLabs feature**. She gave positive feedback about accessibility as a concept; the interview does not verify that a blind person used or could operate the app. The separate low-vision evaluation below is not a screen-reader test.

## Participant B — General-user perspective

- Overall usability and AI interpretation: "É legal"
- Would consider paying: "Não sei é legal acho que sim"
- Opinion about audio accessibility or other accessibility improvements: "Não sei não"
- Suggested asking questions by voice, comparing the interaction to a conversational AI assistant.
- Asked how a blind user would operate a flow that still required typing and clicking.
- Also said she was unsure she would pay in its present form, especially with free alternatives such as Gemini available.
- Permission for anonymous quotation: "Tá"

**Interpretation:** Her reaction to the app was positive but brief. She raised a specific voice-input suggestion and a blind-user concern. Her willingness to pay is **uncertain/tentative**, not a confirmed yes. She did not offer a validated assessment of accessibility. Do not present her answers as a usability test, proof that audio was exercised, or an endorsement from a tarot professional.

## Participant C — Low-vision evaluation

- Tested the app herself on a phone, using magnification and the keyboard's dictation feature to enter a question.
- Positive: liked the language selector and the available spoken-reading controls.
- Concern: found some pale text unreadable even when magnified considerably.
- Privacy question: wondered whether installing the app meant the AI automatically knew her personal details.
- Consent for anonymized use: confirmed by the project owner.

**Interpretation:** This was a hands-on qualitative evaluation, not a WCAG audit. It shows a concrete contrast gap in the dark theme and confirms that the language selector and native read-aloud were discoverable enough to be used. It does not prove that a blind screen-reader user can complete every flow independently; the sample remains three people.

## What we can fairly report

1. One professional evaluator found the reading text understandable and reported a plausible communication use case.
2. The second evaluator responded positively to the general experience, suggested voice input, and raised a blind-user concern; her willingness to pay was uncertain.
3. The third evaluator, who has low vision, tested the app with magnification and dictation; she liked the language selector and spoken-reading controls but found some pale text unreadable even when magnified.
4. The professional explicitly said she would consider paying for a reading-related function; the general user was unsure.
5. All three participants' anonymized use was confirmed by the project owner.
6. The low-vision evaluation found a concrete contrast problem, but it is not a WCAG audit or proof that a blind screen-reader user can complete every flow.

## Next steps

- Do not treat three participants as statistically meaningful; a larger sample would be needed. The low-vision feedback identifies a concrete contrast issue to investigate before claiming accessibility is validated.
- Request feedback using the short Microsoft Forms survey to standardize the tested features and distinguish actual audio use from opinions about potential accessibility.
- Test theme, native read-aloud, keyboard navigation and screen-reader compatibility before claiming accessibility improvements as validated.
- In DEV.to, identify any English quotations as translations from Portuguese, and disclose that the sample size is three.
