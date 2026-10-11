'use strict';
/*
 * OPTIONAL cloud speech-to-text (Google Cloud Speech-to-Text). DISABLED unless you turn it on.
 *   GET  /.netlify/functions/transcribe -> { configured }
 *   POST /.netlify/functions/transcribe -> { audio (base64), mimeType, languageCode } => { transcript, confidence }
 *
 * Enable ONLY after you have checked Google's current pricing/free quota (a Google Cloud billing account is required):
 *   GOOGLE_STT_ENABLED=true  and  GOOGLE_STT_API_KEY=<key restricted to the Speech-to-Text API>
 * The default speech recognition is the browser's built-in one and needs none of this.
 */
const { json, sameOrigin, rateLimit, parseBody, timed, flag } = require('./lib/common');

const MAX_B64 = 4 * 1024 * 1024; // ~3 MB of audio; Netlify request bodies are limited to 6 MB
const DEADLINE_MS = 8500;
const ENC = { 'audio/webm;codecs=opus': 'WEBM_OPUS', 'audio/ogg;codecs=opus': 'OGG_OPUS' };

function configured() {
  return flag(process.env.GOOGLE_STT_ENABLED) && !!process.env.GOOGLE_STT_API_KEY;
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (method === 'GET') return json(200, { configured: configured(), provider: 'google-cloud-speech', optional: true });
  if (method !== 'POST') return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
  if (!sameOrigin(event)) return json(403, { error: 'forbidden_origin' });
  if (!configured()) return json(503, { error: 'not_configured', message: 'Cloud recognition is not enabled on this site.' });
  if (!rateLimit(event, 'stt', 20, 60000)) return json(429, { error: 'rate_limited' });

  const p = parseBody(event, MAX_B64 + 2000);
  if (p.error) return json(p.error, { error: p.error === 413 ? 'too_large' : 'bad_request' });
  const d = p.data || {};
  const mime = String(d.mimeType || '').toLowerCase().replace(/\s+/g, '');
  const encoding = ENC[mime];
  if (!encoding) return json(415, { error: 'unsupported_audio' });
  if (typeof d.audio !== 'string' || !d.audio || d.audio.length > MAX_B64) return json(d.audio && d.audio.length > MAX_B64 ? 413 : 400, { error: 'bad_audio' });
  const lang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(d.languageCode || '') ? d.languageCode : 'en-US';

  const config = { encoding, languageCode: lang, enableAutomaticPunctuation: true, maxAlternatives: 1 };
  if (encoding === 'OGG_OPUS') config.sampleRateHertz = 48000;
  let r;
  try {
    r = await timed('https://speech.googleapis.com/v1/speech:recognize',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_STT_API_KEY },
        body: JSON.stringify({ config, audio: { content: d.audio } }) }, DEADLINE_MS);
  } catch (e) { return json(504, { error: 'timeout' }); }
  if (!r.ok) {
    console.error('transcribe provider status', r.status); // status only - never log audio or keys
    if (r.status === 429) return json(429, { error: 'rate_limited' });
    if (r.status === 401 || r.status === 403) return json(503, { error: 'not_configured', message: 'The speech service is not enabled for this key.' });
    if (r.status === 400) return json(415, { error: 'unsupported_audio' });
    return json(502, { error: 'provider_error' });
  }
  const j = await r.json().catch(() => ({}));
  const alt = j.results && j.results[0] && j.results[0].alternatives && j.results[0].alternatives[0];
  const transcript = ((j.results || []).map(x => x.alternatives && x.alternatives[0] && x.alternatives[0].transcript || '').join(' ')).trim();
  return json(200, { transcript, confidence: alt && typeof alt.confidence === 'number' ? alt.confidence : 0.7 });
};
