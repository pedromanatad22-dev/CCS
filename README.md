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
