# Changelog

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
