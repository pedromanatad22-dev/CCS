// Netlify Function: private proxy to the SimSimi API.
// The API key lives ONLY in the Netlify environment variable SIMSIMI_API_KEY (never in the web page).
// Optional: SIMSIMI_URL (default https://wsapi.simsimi.com/190410/talk) and SIMSIMI_LANG (default "en").
const H={'Content-Type':'application/json','Cache-Control':'no-store'};
const out=(c,o)=>({statusCode:c,headers:H,body:JSON.stringify(o)});
exports.handler=async(event)=>{
  const key=process.env.SIMSIMI_API_KEY;
  if(event.httpMethod==='GET')return out(200,{configured:!!key});
  if(event.httpMethod!=='POST')return out(405,{error:'method not allowed'});
  if(!key)return out(503,{error:'not configured'});
  let b={};try{b=JSON.parse(event.body||'{}')}catch(e){return out(400,{error:'bad json'})}
  const utext=String(b.text||'').trim().slice(0,300);
  if(!utext)return out(400,{error:'empty text'});
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),8000);
  try{
    const r=await fetch(process.env.SIMSIMI_URL||'https://wsapi.simsimi.com/190410/talk',{method:'POST',signal:ctl.signal,
      headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify({utext,lang:process.env.SIMSIMI_LANG||'en'})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.atext)return out(r.ok?502:r.status,{error:String(j.statusMessage||j.detail||'no reply')});
    return out(200,{text:String(j.atext)});
  }catch(e){return out(502,{error:'unreachable'})}finally{clearTimeout(to)}
};
