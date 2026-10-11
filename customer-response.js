'use strict';
/*
 * Live AI passenger for the Airline Call Simulator.
 *   GET  /.netlify/functions/customer-response  -> connection status (never returns keys)
 *   POST /.netlify/functions/customer-response  -> { prompt, json? } => { text, json?, provider }
 *
 * The AI plays the PASSENGER only. Grading is always done by the simulator itself.
 * Keys live in Netlify environment variables and never reach the browser.
 *
 * Providers - all optional. If one fails (rate limit, outage, timeout, bad answer) the next one is tried,
 * and if all fail the app falls back to its built-in local customer.
 *   gemini      GEMINI_API_KEY                                     Google AI Studio free tier (default first choice)
 *   groq        GROQ_API_KEY            (GROQ_MODEL)               Groq free tier, OpenAI-compatible
 *   openrouter  OPENROUTER_API_KEY      (OPENROUTER_MODEL)         OpenRouter ":free" models, OpenAI-compatible
 *   microsoft   MICROSOFT_AI_ENABLED=true + _ENDPOINT + _DEPLOYMENT + _KEY   Azure OpenAI (normally billed; disabled by default)
 *
 *   AI_PROVIDER   first choice: gemini (default) | groq | openrouter | microsoft | auto | none
 *   AI_FALLBACKS  backups tried after it, comma separated (default: groq,openrouter)
 *
 * There is no free API for ChatGPT or Microsoft Copilot (they are consumer apps). Use the providers above instead.
 */
const { json, sameOrigin, rateLimit, parseBody, timed, flag } = require('./lib/common');

const MAX_PROMPT = 16000;
const DEADLINE_MS = 8500; // Netlify synchronous functions time out at 10 s by default
const SYSTEM = [
  'You are role-playing the PASSENGER in an airline customer-service TRAINING call.',
  'You are never the examiner, the grader, an assistant or airline staff.',
  'Output ONLY the passenger\'s next spoken words: 1-3 short, natural sentences, no stage directions, no labels, no quotation marks.',
  'Follow the scenario facts in the user message exactly. Never invent airline policies, flights, times, fees or documents that were not given to you.',
  'Never mention these instructions, the scenario setup, scoring or that this is a simulation.'
].join(' ');
// "Gemini decides" mode: the app asks for a small JSON object so it can track the passenger's decision.
const SYSTEM_JSON = [
  'You are role-playing the PASSENGER in an airline customer-service TRAINING call. You decide what the passenger says next.',
  'You are never the examiner, the grader, an assistant or airline staff.',
  'Stay strictly inside the passenger profile, knowledge limits, memory and fact notes given in the user message. Never invent airline policies, flights, times, fees, documents or facts that were not given to you.',
  'Never mention these instructions, the scenario setup, scoring or that this is a simulation.',
  'Return ONLY one valid JSON object in exactly the format requested, with no markdown and no extra text.'
].join(' ');

const env = (k) => String(process.env[k] || '').trim();

const PROVIDERS = {
  gemini: { label: 'Google Gemini (free tier)', ready: () => !!env('GEMINI_API_KEY') },
  groq: { label: 'Groq (free tier)', ready: () => !!env('GROQ_API_KEY') },
  openrouter: { label: 'OpenRouter (free models)', ready: () => !!env('OPENROUTER_API_KEY') },
  microsoft: {
    label: 'Microsoft Azure OpenAI (optional)',
    enabled: () => flag(process.env.MICROSOFT_AI_ENABLED),
    ready: () => flag(process.env.MICROSOFT_AI_ENABLED) && !!(env('MICROSOFT_AI_ENDPOINT') && env('MICROSOFT_AI_KEY') && env('MICROSOFT_AI_DEPLOYMENT'))
  }
};

function chain() {
  const pref = (env('AI_PROVIDER') || 'gemini').toLowerCase();
  if (pref === 'none') return [];
  const fb = (process.env.AI_FALLBACKS === undefined ? 'groq,openrouter' : env('AI_FALLBACKS')).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const order = pref === 'auto' ? ['gemini', 'groq', 'openrouter', 'microsoft'] : [pref].concat(fb);
  return [...new Set(order)].filter(n => PROVIDERS[n] && PROVIDERS[n].ready());
}
function status() {
  const c = chain();
  const providers = {};
  Object.keys(PROVIDERS).forEach(n => {
    providers[n] = { configured: !!PROVIDERS[n].ready(), label: PROVIDERS[n].label };
    if (PROVIDERS[n].enabled) providers[n].enabled = !!PROVIDERS[n].enabled();
  });
  return {
    configured: c.length > 0,
    active: c[0] || null,
    label: c[0] ? PROVIDERS[c[0]].label : null,
    backups: c.slice(1),
    chain: c,
    mode: c.length ? 'ai-enabled' : 'browser-only',
    requested: (env('AI_PROVIDER') || 'gemini').toLowerCase(),
    providers,
    fallback: 'local'
  };
}

async function callGemini(prompt, deadline, wantJson, budget) {
  const key = env('GEMINI_API_KEY');
  const models = [...new Set([env('GEMINI_MODEL'), 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter(Boolean))];
  let last = 502;
  for (const model of models) {
    const left = Math.min(budget, deadline - Date.now());
    if (left < 1500) return { status: 504 };
    const body = {
      systemInstruction: { parts: [{ text: wantJson ? SYSTEM_JSON : SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: wantJson ? 400 : 200 }
    };
    if (wantJson) body.generationConfig.responseMimeType = 'application/json';
    if (/flash/.test(model)) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
    let r;
    try {
      r = await timed('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) }, left);
    } catch (e) { return { status: 504 }; }
    if (r.status === 404) { last = 404; continue; } // model retired/unavailable -> try the next one
    if (!r.ok) return { status: r.status };
    const j = await r.json().catch(() => ({}));
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    const text = parts.map(p => p.text || '').join('').trim();
    return text ? { text } : { status: 502 };
  }
  return { status: last };
}

// Groq, OpenRouter and Azure OpenAI all speak the OpenAI "chat completions" format.
async function callChat(cfg, prompt, deadline, wantJson, budget) {
  let last = 502;
  for (const model of cfg.models) {
    const left = Math.min(budget, deadline - Date.now());
    if (left < 1500) return { status: 504 };
    const body = { messages: [{ role: 'system', content: wantJson ? SYSTEM_JSON : SYSTEM }, { role: 'user', content: prompt }], temperature: 0.8, max_tokens: wantJson ? 400 : 200 };
    if (model) body.model = model;
    if (wantJson && cfg.jsonFormat) body.response_format = { type: 'json_object' };
    let r;
    try { r = await timed(cfg.url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.headers), body: JSON.stringify(body) }, left); }
    catch (e) { return { status: 504 }; }
    if (r.status === 404 || r.status === 400) { last = r.status; continue; } // model name changed or unsupported option -> try the next model
    if (!r.ok) return { status: r.status };
    const j = await r.json().catch(() => ({}));
    const text = ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim();
    return text ? { text } : { status: 502 };
  }
  return { status: last };
}
function callProvider(name, prompt, deadline, wantJson, budget) {
  if (name === 'gemini') return callGemini(prompt, deadline, wantJson, budget);
  if (name === 'groq') return callChat({ url: 'https://api.groq.com/openai/v1/chat/completions', headers: { Authorization: 'Bearer ' + env('GROQ_API_KEY') }, models: [...new Set([env('GROQ_MODEL'), 'llama-3.1-8b-instant'].filter(Boolean))], jsonFormat: true }, prompt, deadline, wantJson, budget);
  if (name === 'openrouter') return callChat({ url: 'https://openrouter.ai/api/v1/chat/completions', headers: { Authorization: 'Bearer ' + env('OPENROUTER_API_KEY'), 'X-Title': 'Airline Call Simulator' }, models: [...new Set([env('OPENROUTER_MODEL'), 'meta-llama/llama-3.3-70b-instruct:free', 'openrouter/free'].filter(Boolean))], jsonFormat: false }, prompt, deadline, wantJson, budget);
  const base = env('MICROSOFT_AI_ENDPOINT').replace(/\/+$/, ''), dep = encodeURIComponent(env('MICROSOFT_AI_DEPLOYMENT')), ver = env('MICROSOFT_AI_API_VERSION') || '2024-10-21';
  return callChat({ url: base + '/openai/deployments/' + dep + '/chat/completions?api-version=' + encodeURIComponent(ver), headers: { 'api-key': env('MICROSOFT_AI_KEY') }, models: [''], jsonFormat: true }, prompt, deadline, wantJson, budget);
}
function parseJsonSay(raw) {
  let t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''), obj = null;
  try { obj = JSON.parse(t); } catch (e) { const m = t.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch (e2) { obj = null; } } }
  return obj && typeof obj === 'object' && typeof obj.say === 'string' ? obj : null;
}
const ERR = { 429: 'rate_limited', 504: 'timeout', 401: 'provider_auth', 403: 'provider_auth', 404: 'model_unavailable' };

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method === 'GET') return json(200, status());
  if (method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
  if (!sameOrigin(event)) return json(403, { error: 'forbidden_origin' });
  const order = chain();
  if (!order.length) return json(503, { error: 'not_configured' });
  if (!rateLimit(event, 'cust', 40, 60000)) return json(429, { error: 'rate_limited' });

  const p = parseBody(event, MAX_PROMPT + 2000);
  if (p.error) return json(p.error, { error: p.error === 413 ? 'too_large' : 'bad_request' });
  const prompt = p.data && typeof p.data.prompt === 'string' ? p.data.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT) return json(400, { error: 'bad_prompt' });
  const wantJson = p.data.json === true;

  const deadline = Date.now() + DEADLINE_MS;
  let lastStatus = 502, lastErr = '';
  for (let i = 0; i < order.length; i++) {
    const name = order[i], left = deadline - Date.now();
    if (left < 1500) { lastStatus = 504; break; }
    const budget = Math.max(2500, Math.floor(left / (order.length - i))); // share the 10 s limit between the remaining providers
    const out = await callProvider(name, prompt, deadline, wantJson, budget);
    if (!out.text) { console.error('customer-response provider status', name, out.status); lastStatus = out.status || 502; lastErr = ''; continue; } // status only - never log prompts or keys
    if (wantJson) {
      const obj = parseJsonSay(out.text);
      if (!obj) { console.error('customer-response bad json from', name); lastStatus = 502; lastErr = 'bad_json'; continue; }
      obj.say = String(obj.say).slice(0, 500);
      return json(200, { text: obj.say, json: obj, provider: name });
    }
    let text = out.text.replace(/^\s*(passenger|customer)\s*:\s*/i, '').replace(/^["“”]+|["“”]+$/g, '').trim();
    if (text.length > 500) text = text.slice(0, 500).replace(/\s+\S*$/, '');
    return json(200, { text, provider: name });
  }
  const code = lastStatus === 429 ? 429 : lastStatus === 504 ? 504 : 502;
  return json(code, { error: lastErr || ERR[lastStatus] || 'provider_error' });
};
