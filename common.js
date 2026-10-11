'use strict';
// Shared helpers for the Netlify Functions. No external dependencies.
const buckets = new Map();

function headers(extra) {
  return Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, extra || {});
}
function json(statusCode, obj, extra) {
  return { statusCode, headers: headers(extra), body: JSON.stringify(obj) };
}
function hdr(event, name) {
  const h = event.headers || {};
  return h[name] || h[name.toLowerCase()] || '';
}
// Only accept browser calls that come from this same site (stops other sites from using your quota).
// Add custom domains to the ALLOWED_ORIGINS env var if you use one (comma separated).
function sameOrigin(event) {
  const origin = hdr(event, 'origin');
  if (!origin) return true; // same-origin GET/POST from the page may omit Origin
  let host;
  try { host = new URL(origin).host; } catch (e) { return false; }
  const mine = (hdr(event, 'x-forwarded-host') || hdr(event, 'host')).split(',')[0].trim();
  if (host === mine) return true;
  const allow = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return allow.includes(origin) || allow.includes(host);
}
// Best-effort per-client limiter (memory is per function instance, so it is a safety net, not a guarantee).
function rateLimit(event, key, max, windowMs) {
  const ip = (hdr(event, 'x-nf-client-connection-ip') || hdr(event, 'x-forwarded-for') || 'anon').split(',')[0].trim();
  const k = key + ':' + ip, now = Date.now();
  let b = buckets.get(k);
  if (!b || now - b.t > windowMs) { b = { t: now, n: 0 }; buckets.set(k, b); }
  b.n++;
  if (buckets.size > 2000) { for (const [kk, v] of buckets) if (now - v.t > windowMs) buckets.delete(kk); }
  return b.n <= max;
}
function parseBody(event, maxChars) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (raw.length > maxChars) return { error: 413 };
  try { return { data: JSON.parse(raw) }; } catch (e) { return { error: 400 }; }
}
async function timed(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); }
  finally { clearTimeout(t); }
}
const flag = (v) => String(v || '').trim().toLowerCase() === 'true';

module.exports = { json, hdr, sameOrigin, rateLimit, parseBody, timed, flag };
