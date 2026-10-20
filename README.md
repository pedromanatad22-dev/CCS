# Airline Call Simulator — Netlify deployment

Your existing simulator, prepared for **Netlify Free**. Nothing was rebuilt: `index.html` is your file with a connection-status panel added and the AI/speech endpoints pointed at the new Netlify Functions. Grading, scenarios, reports, scripts, practice/assessment modes, trainer mode and the local customer are unchanged.

**Two modes — same code**

| Mode | What you do | What works |
|---|---|---|
| **Browser-Only** (default) | Deploy the folder. Nothing else. | Local fallback customer, browser speech recognition, text input, text-to-speech, all grading and reports. |
| **AI-Enabled** | Add environment variables in Netlify, then redeploy. | Same as above + live AI passenger (Gemini free tier; Microsoft optional) + optional Google cloud speech. |

If AI or cloud speech is off, slow, rate-limited or down, the app silently falls back to the local customer / browser or typed input. **Outages never reduce a student's grade.**

---

## 1. Deploy (about 3 minutes)

The folder must keep this structure:

```
airline-call-simulator/
├── index.html
├── 404.html
├── netlify.toml
├── .env.example            (names only — no secrets)
└── netlify/functions/
    ├── customer-response.js   live AI passenger (Gemini / optional Microsoft)
    ├── customer.js            alias for older copies of index.html
    ├── transcribe.js          optional Google cloud speech-to-text (off by default)
    └── lib/common.js
```

**Option A — Git (recommended for the functions):** push the folder to a GitHub repo → Netlify → *Add new project → Import from Git* → leave the build command empty and the publish directory as `.` (the `netlify.toml` already says so).

**Option B — Netlify CLI:** `npm i -g netlify-cli`, then inside the folder `netlify deploy --prod`.

**Option C — drag & drop** (`app.netlify.com/drop`): fine for **Browser-Only** mode. Drag-and-drop deploys *can* bundle functions, but Netlify's documentation focuses on static sites, so after deploying check **Site → Functions**. If your two functions are not listed, use Option A or B.

Open your site. The **AI & speech connection** card on the start screen shows what is connected.

## 2. Turn on the live AI customer (Gemini, free tier)

1. Create a key at **https://aistudio.google.com/apikey** (no credit card needed for the free tier).
2. Netlify → *Site configuration → Environment variables* → add `GEMINI_API_KEY` = your key (mark it as a secret).
3. Trigger a new deploy (*Deploys → Trigger deploy*). Environment-variable changes apply to the next deploy.
4. Reload the site → the card shows **Google Gemini ✅ Connected — active** and the *Passenger engine* list offers **Live AI customer**.

Optional variables: `GEMINI_MODEL` (default `gemini-2.5-flash`; the function also tries `gemini-2.5-flash-lite` if a model is retired) and `AI_PROVIDER` (`gemini` default, `microsoft`, `auto`, `none`; `none` switches the AI off without removing the key).

**Only you set credentials.** Students never see or enter a key; the browser only talks to your own site's function, and the key never leaves Netlify.

## 3. Optional: Microsoft AI (disabled by default)

Official Azure OpenAI API only. It stays **off** even if the other variables exist unless you set `MICROSOFT_AI_ENABLED=true`:
`MICROSOFT_AI_ENABLED`, `MICROSOFT_AI_ENDPOINT` (`https://YOUR-RESOURCE.openai.azure.com`), `MICROSOFT_AI_DEPLOYMENT`, `MICROSOFT_AI_KEY`, optional `MICROSOFT_AI_API_VERSION`, and `AI_PROVIDER=microsoft` (or `auto`). Azure OpenAI is generally billed — enable it only if you have confirmed free credits or accept the cost. There is no Copilot scraping.

## 4. Speech recognition

* **Default — browser Speech API** (free, nothing to configure; Chrome/Edge work best). Start/Stop Speaking, status pill, "check the text first" option and typed input are all kept. Browsers may send audio to their vendor's speech service.
* **Optional — Google Cloud Speech-to-Text** via `transcribe.js`: off by default. It needs a Google Cloud **billing account** even though a monthly free quota exists. Only after you have checked Google's current free limits, set `GOOGLE_STT_ENABLED=true` and `GOOGLE_STT_API_KEY` (restrict the key to the Speech-to-Text API and set a budget alert). A key alone does **not** enable it.

## 5. Free-tier limits — please read

* **Netlify Free** has monthly usage limits (function invocations / compute) and synchronous functions time out after about 10 seconds. Netlify changes plan terms from time to time — check your own dashboard and https://www.netlify.com/pricing. Each AI customer reply is one function call.
* **Gemini free tier** is rate-limited per minute and per day, limits differ by model and change over time, and Google may use free-tier prompts to improve its products (some regions excluded). Check the limits shown in Google AI Studio for your project. When the limit is hit the app pauses the AI for a minute and uses the local customer.
* The functions add a best-effort per-visitor rate limit and reject requests from other websites. This is a safety net, not a quota guarantee.
* Nothing here auto-bills: Gemini free tier needs no card, Microsoft and Google Speech are disabled until you enable them.
* **Privacy:** the live AI receives only the fictional passenger scenario and recent call text. Student names and grading data are not sent. Tell students to use simulated details only.

## 6. Test locally (optional)

`npx netlify-cli dev` serves the site and the functions at http://localhost:8888 (create a `.env` file from `.env.example` for keys — never commit it). Opening `index.html` directly from disk works in Browser-Only mode; the card will say functions are not available.

## 7. Troubleshooting

| Card shows | Meaning / fix |
|---|---|
| Gemini ❌ Not configured | Add `GEMINI_API_KEY`, then redeploy. |
| ❌ Not reachable | Functions were not deployed — check **Site → Functions**; use Git or CLI deploy. |
| ⚪ Not available when opened as a file | Open the Netlify URL instead. |
| Live AI keeps falling back | Quota or rate limit reached, or an invalid key — see **Site → Functions → customer-response → logs** (they contain status codes only, never prompts or keys). |
| Microphone does nothing | Allow the microphone for the site, use Chrome/Edge, or choose *Text fallback*. |

## 8. What changed in your code

* `index.html`: new **AI & speech connection** card (Browser-Only / AI-Enabled, per-provider ✅/❌, fallback notice, Re-check button); endpoints now `/.netlify/functions/customer-response`; AI wording follows the active provider.
* New: `netlify.toml` (headers, microphone permission, hides source files), the three functions, `.env.example`, this README.
* Unchanged: the 100-point grading rubric (Beginner/Moderate/Expert levels, pass marks), scenarios, scripts, transcript, exports, UI and layout.

## 9. "Gemini decides" — how the live AI customer works (v10)

With **Passenger engine = Live AI customer**, the setting **Live AI style** controls who decides what the customer says:

* **Gemini decides what the customer says** (default): Gemini chooses the reply, but only inside the passenger's profile.
  It is given the customer's profile and personality, goal and mood, **the full call so far plus a memory of what the rep has said**, the rep's latest statement, and "fact notes" computed from the customer's own records (for example the booking reference or age the rep just asked for, or that the rep got the route wrong).
  It is told what a person with that profile would *not* know — other flights and times, fares, fees, airline rules, the cancellation cause (until the rep says it) — and those items are never put in its prompt.
* **Every reply is fact-checked before it is spoken.** It is rejected if it ignores the rep's actual question, gives a wrong name/reference/age, mentions a flight, time or price nobody told the customer, states airline policy, accepts an option that does not meet the customer's need, ends the call early, asks for a supervisor too soon, repeats itself, or asks about something already answered. A rejected reply is regenerated once with the reasons; if it still fails, the built-in rule-based customer answers instead, so a call never breaks.
* **Rules decide, Gemini only rewords**: the previous behaviour, kept as an option.
* Hang-ups, emotion/trust tracking and grading stay under the simulator's control, so scoring is identical in both styles.

The function now also supports a JSON mode (`{ "prompt": "...", "json": true }`) used by this feature. Text mode is unchanged.

*Note:* your `Test_5` page also has an optional SimSimi voice that calls `/.netlify/functions/simsimi`. That function is not part of this package, so the option simply shows as unavailable unless you add your own.

## 10. Free backup AI — what about ChatGPT and Copilot?

**There is no free ChatGPT or Microsoft Copilot API.** Both are consumer apps (and scraping them is not allowed). OpenAI's API and Microsoft's Azure OpenAI are billed services.
Instead, the live AI customer can fall back to two **free-tier** providers that use the same standard API:

| Provider | Free key | Notes |
|---|---|---|
| **Groq** | https://console.groq.com/keys (no card) | Fast open models (Llama). Free-tier limits vary by model and change. |
| **OpenRouter** | https://openrouter.ai/keys (no card) | Many ":free" models behind one key. Free usage is tightly limited per day. Keep a ":free" model name so nothing is billed. |

**How it works:** add `GROQ_API_KEY` and/or `OPENROUTER_API_KEY` in Netlify and redeploy. The function tries your first choice (`AI_PROVIDER`, default Gemini), then the backups in `AI_FALLBACKS` (default `groq,openrouter`). It moves to the next provider on a rate limit, outage, timeout or unreadable answer, and if every provider fails the app uses its built-in local customer. With only a Groq key (no Gemini key) Groq simply becomes the main provider. The start-screen status card shows which are connected.

**Things to know**
* Free tiers change often, so check each provider's current limits and data terms. Free-tier providers may use prompts to improve their products, so keep using fictional details only.
* Smaller free models follow instructions less reliably than Gemini. That is why every reply is still fact-checked and the local customer remains the last fallback.
* Model names get renamed or retired. If a backup stops working, set `GROQ_MODEL` / `OPENROUTER_MODEL` to a current free model.
* Microsoft stays off unless you set `MICROSOFT_AI_ENABLED=true` (use `AI_PROVIDER=auto` to include it last).

## 11. Training Mode (live coaching while you practice)

* **Turn it on:** on the home dashboard, switch **Training Mode** to ON before you start a call. The setting is remembered. It is **not available in Assessment mode** (assessments give no hints). The older "Training mode" dropdown was renamed **Practice or assessment** to avoid confusion.
* **What you see:** during a call, a **Training Assistant** panel appears on the right of the conversation (below it on small screens, collapsible). It shows **INFORMATION YOU SHOULD ASK** (the most important missing items for this scenario, with the next one highlighted), then **exactly two correct example replies**: A (empathetic and reassuring) and B (direct and efficient).
* **Use Response A / B** puts the wording into the message box for you to edit, then Send or say it yourself. It never sends anything, and it will not replace speech your microphone is capturing. **Hear** reads the suggestion aloud.
* **It updates every turn:** items disappear once you have asked for them or the customer has already told you. You can switch it off or on mid-call.
* **Separate from grading:** training never changes the customer, the score or the report criteria. The report only adds a small note saying how often the guidance was shown or used ("not part of your score").
* **How it works:** it uses a built-in, scenario-based guide for every scenario (booking, change, missed connection, refund, baggage, wheelchair, name correction, minors, and the cancellation scenarios). It does not use AI and does not invent policy, prices, flights or outcomes. Where the rep must read real data (flights, fares) the suggestion shows a placeholder such as [flights and fare from your search results]. The logic is in one place (`TRAIN_STEPS` and `trSuggest`) so an AI suggestion engine can replace it later.

## 12. AI Training Assistant (Gemini coach)

With **Training Mode ON** and **Training Assistant engine = Gemini coach**, the right-hand panel becomes a scenario-aware coach:

* **SCENARIO** (what the customer needs and the training objective), **WHAT YOU SHOULD DO NEXT** (one prominent action), **INFORMATION YOU STILL NEED TO ASK** (each item marked Missing / Asked / Provided / Verified / Pending / Not applicable), **two suggested responses** (A recommended, B alternative, each with *Use Response* and *Hear*), **WHY THIS RESPONSE IS BEST**, **SCORE IMPROVEMENT** (the rubric criteria still to satisfy) and any **policy warnings**.
* **What Gemini is given** (built in the browser, sent to your own site): the scenario and rules, the customer profile and personality, the customer's first message, the grading rubric for the level you selected (Beginner/Moderate 100 pts, Expert 35 pts, or the 12 skills), critical mistakes, the required questions, the checklist with statuses, the flights actually on screen and the booking state, and the last 10 turns. Hidden scenario facts are flagged so the coach tells you which question to ask rather than revealing them.
* **Status meanings:** *Provided* = the customer gave it. *Verified* = you also read it back. Nothing is "verified" against an outside source, because this version has no Booking Verification workspace; the coach treats all data as simulated.
* **Safety:** every coach answer is checked before it is shown. It must contain exactly two different replies, stay short, include no unsupported claims (booked, refunded, guaranteed, CVV), no flight/time/price that is not in the conversation or on screen, no hidden-fact leak, and must not re-ask for information already given. If a check fails, or Gemini is slow, rate-limited or down, the built-in guidance is shown instead and the call continues.
* **Triggers:** it updates when the customer has finished speaking, and after you search flights or confirm a booking (debounced, so no request loops). Suggestions never speak, send or replace your typing or speech.
* **Scoring is separate.** The coach never changes the customer, the score or the report. The report only notes how often guidance was shown or used.

**Setup** (same Gemini key as the live customer): nothing new is required if `GEMINI_API_KEY` is already set. The browser calls `/api/training-assistant` (a redirect to `/.netlify/functions/training-assistant`, defined in `netlify.toml`). Optional variables: `GEMINI_TRAINING_MODEL` (model for the coach; default `gemini-2.5-flash`), `TRAINING_FALLBACKS=groq,openrouter` (free backups, off by default) and `TRAINING_AI=off` (switch the AI coach off; built-in guidance remains). The key never reaches the browser. Upload the new `index.html`, `netlify.toml` and `netlify/functions/training-assistant.js`, then redeploy.

**Limits:** the rubric descriptions the coach receives (`RUB7`, `RUB12` in `index.html`) mirror the grader's criteria and must be updated by hand if you change the grading. The coach helps you meet every criterion but cannot guarantee a perfect score. In Assessment mode the coach is disabled. Opening the file from disk shows only the built-in guidance.
