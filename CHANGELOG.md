# Changelog

## 13.0 — Training Mode phrases fixed after the audit
**Fixed**
- "Okay"/"Sure, take your time" no longer triggers the vague "I'll note that and explain what happens next". Filler moves the call to the next required step. A suggestion is never shown three times in a row.
- Concrete wording for options (real flights, times, fare), confirmation, documents, what to keep ready, read-back of the details the customer gave, and a closing that checks the concern was handled.
- Suggestions now adapt to the customer's real personality, the difficulty, and the starting and current emotion. They previously did not change at all.
- Direct questions, "explain that", update requests, "I already told you", long-wait complaints and objections get specific answers; objections in refund and minor calls get the real rule and the alternative.
- Checklist steps are only marked done when the required statement was really made (previously "let me check" ended the policy step too early, so the eligibility decision for minors was never suggested).
- Added checklist steps: name, what happened and what you need, flight/route/date, read-back, and documents for every scenario. Recognition of cancelled-flight, missing-bag and "update" messages.
- Wording avoids the grader's known traps. Unknown cancellation cause no longer blocks the call.

**Measured (simulated):** following suggestion A averaged 89 (was 48), best 100 (was 75), about 96% of calls reached the 70 pass mark (was 3%). The grading rubric and scoring code are unchanged.


## 12.1 — Knowledge Center without a password, and a history of pasted knowledge
**Changed**
- The Knowledge Center no longer asks for a password. `LEARNING_ADMIN_KEY` is now optional: if it is set (12+ characters) the page asks for it, as before. With no key, changes are accepted only from this site's own pages (Origin check), which stops other websites but is not a substitute for a password. A too-short key is rejected with a clear message and never silently opens the page.
- Pasted knowledge is now labelled **Pasted text** and conversation learning is labelled **From conversations**.

**Added**
- **Knowledge history** tab: every pasted text is kept in full (date, category, status, earlier wordings after edits). Remove it (stops being used, text kept), restore it, or erase it permanently. Library "Remove" keeps the paste in the history. Patterns learned from conversations can also be removed from use there.
- Warning banner on the page when no password is set.

**Unchanged:** automatic learning, validation, semantic customer, Booking Verification Workspace, Training Mode and the grading rubric.

## 12.0 — AI learning engine, semantic customer, Knowledge Center
**Added**
- `semantic.js`: shared recognizer that maps what the agent means to the field being asked for. Paraphrased verification questions answered correctly: rule-based customer 10/35 → 35/35; cancellation customer 4/24 → 24/24.
- Internal verification tracker (PENDING, REQUESTED, COLLECTED, CONFIRMED, INVALID) in the Trainer view and in the AI customer prompt.
- Automatic Session Learning Engine: redacted capture with a retry outbox, background analysis with queue, retries, idempotency and inline fallback, A/B/C/D validation, consolidation, learning suggestions, relationships, audit log, retention, backups, export.
- AI Knowledge Center and Session Learning Center (`knowledge-center.html`), protected by `LEARNING_ADMIN_KEY`.
- Retrieval of approved knowledge and observed reactions into the Gemini-decides customer prompts.
- Netlify functions `learning`, `learning-analyze-background`, `learning-retry`; storage on Netlify Blobs (`package.json`).
- *AI learning* switch on the start screen (opt out).

**Changed:** the customer's question recognition (rule-based, cancellation and policy paths) falls back to the semantic recognizer.
**Unchanged:** personality, difficulty and starting-emotion behaviour; grading rubric, weights and calculations; Booking Verification Workspace; Training Mode.

## 11.1 — Training Mode: suggested phrases now fit the moment and the rubric
**Why it was wrong.** The old generator chose its text from the next missing checklist item plus a few keyword openers. It never worked out what the customer's latest message actually needed, so a question, an objection, a thank-you and a complaint all got a similar "Thank you for that / I'm sorry about that" opener followed by the next question. The explanation was tied to the checklist step, not to the grading criterion for that moment. Several steps also could not recognise their own question (for example the contact-details question for a minor), which made the coach ask the same thing again and again.

**What changed (Training Mode only; Training Mode OFF is untouched).**
- Each turn is classified from what the customer actually said: opening, issue reported, information given, direct question, request, update request, objection, acceptance, frustration, correction, manager request, unclear, resolved.
- The phrase is built for that situation: it names the real issue, reads back details the customer just gave, answers questions only from information on screen (otherwise says it will check, then moves to the action), answers an objection with a search for a better option, does not close while something required is open, never repeats a full greeting, and never promises a refund, booking or compensation.
- Every phrase shows **Suggested Phrase**, **Why this earns credit** (the existing rubric criterion for the level in use, and the behaviour it demonstrates) and **Next step**.
- The Gemini coach's answers go through the same relevance and rubric-alignment check; an answer that ignores the customer's latest statement is replaced by the built-in phrase.
- Fixed six checklist steps whose own question did not match their detection pattern.

**Unchanged:** the grading rubric, weights, pass marks and calculations (verified by comparing the scoring code before and after), the customer simulation, and Normal mode. Suggestions never award points; scoring reads only what the trainee actually says.

## 11.0 — Booking Verification Workspace (this release)
**Added**
- Booking Verification Workspace on the call screen: booking search (PNR, surname, first name, flight, date, origin, destination), Clear Search, Refresh Booking Data, BOOKING NOT FOUND, multiple-match selection, missing-information messages.
- Passenger identity verification, three-column itinerary view (customer requested / existing booking / proposed replacement) with cancelled flights marked, 12-item verification checklist (Not Started, In Progress, Passed, Failed, Not Applicable) with evidence and history.
- Discrepancies and Alerts panel (Informational / Warning / Critical with expected, actual, evidence, next action).
- Verification decision panel with five decisions, enforced in code.
- Confirm Booking is gated by the verification result; booking confirmation and ticket issuance are separate simulated actions.
- Escalate opens a simulated escalation form (Draft, Submitted, Awaiting Supervisor, Resolved).
- Verification records saved in the browser and downloadable (JSON); report card.
- Dashboard switch to turn the workspace ON/OFF (OFF = previous behaviour).
- Version stamp (header tag, meta tag, window.APP_VERSION) and no-cache headers for index.html so a new deploy takes over the old version immediately.

**Changed (explained, not silent)**
- 7-criteria rubric: one added item inside *Verify Flight/Travel Information* and penalties for bypassed/incorrect verification (only when the workspace is ON). 12-skill grader: Accuracy and Proper Escalation adjustments. Weights, pass marks and formulas are unchanged.
- The AI customer prompt and the AI Training Assistant now receive the same booking/workspace facts.

**Unchanged:** scenarios, customer behaviour, voice features, Search Flights, grading levels and reports, Netlify functions (customer-response, transcribe, training-assistant).

## 10.x and earlier
Gemini-decides customer, free backup providers (Groq, OpenRouter), AI Training Assistant (Gemini coach), Training Mode, conversation-repair and ending fixes, 7-criteria grading for every scenario.
