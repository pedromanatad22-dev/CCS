// Netlify Function used by the Airline Call Simulator for the "Live AI customer" (Google Gemini via Netlify AI Gateway).
// GEMINI_API_KEY and GOOGLE_GEMINI_BASE_URL are injected by Netlify AI Gateway at runtime — never in the web page.
// Optional env vars: GEMINI_MODEL (default "gemini-3.5-flash").
const H={'Content-Type':'application/json','Cache-Control':'no-store'};
const out=(c,o)=>new Response(JSON.stringify(o),{status:c,headers:H});
export default async(req)=>{
  const key=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL||'gemini-3.5-flash';
  const base=(process.env.GOOGLE_GEMINI_BASE_URL||'https://generativelanguage.googleapis.com').replace(/\/$/,'');
  if(req.method==='GET')return out(200,{configured:!!key,active:key?'gemini':null,model,providers:{gemini:{configured:!!key},microsoft:{configured:false,enabled:false}}});
  if(req.method!=='POST')return out(405,{error:'method not allowed'});
  if(!key)return out(503,{error:'not configured'});
  let b={};try{b=JSON.parse(await req.text()||'{}')}catch(e){return out(400,{error:'bad json'})}
  const prompt=String(b.prompt||'').slice(0,12000);
  if(!prompt)return out(400,{error:'empty prompt'});
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),20000);
  try{
    const r=await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
      method:'POST',signal:ctl.signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.9,maxOutputTokens:1024}})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)return out(r.status,{error:String((j.error&&j.error.message)||'gemini error').slice(0,200)});
    const text=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||'').join('').trim();
    return text?out(200,{text}):out(502,{error:'empty'});
  }catch(e){return out(502,{error:'unreachable'})}finally{clearTimeout(to)}
};
