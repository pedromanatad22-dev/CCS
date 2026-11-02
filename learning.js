'use strict';
/* Learning engine API. Public (same-origin, rate limited): status, session, patterns, retrieve. Admin (x-admin-key): everything else.
   Routes are served at /api/learning/<route> (redirect in netlify.toml). */
const crypto=require('crypto');
const{json,sameOrigin,rateLimit,parseBody}=require('./lib/common');
const ops=require('./lib/ops');const E=require('./lib/engine');
const env=k=>String(process.env[k]||'').trim();
const sha=s=>crypto.createHash('sha256').update(String(s)).digest();
function adminState(event){const key=env('LEARNING_ADMIN_KEY');if(key.length<12)return'not_configured';const got=String((event.headers||{})['x-admin-key']||(event.headers||{})['X-Admin-Key']||'');return got&&crypto.timingSafeEqual(sha(got),sha(key))?'ok':'denied'}
const jobToken=id=>crypto.createHmac('sha256',env('LEARNING_ADMIN_KEY')||'learning-default').update(id).digest('hex').slice(0,32);
async function trigger(event,jobId){try{const h=event.headers||{},host=h.host||h.Host,proto=h['x-forwarded-proto']||'https';if(!host)return false;const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),2500);const r=await fetch(proto+'://'+host+'/.netlify/functions/learning-analyze-background',{method:'POST',headers:{'Content-Type':'application/json','x-learn-job':jobToken(jobId)},body:JSON.stringify({jobId}),signal:ctl.signal});clearTimeout(t);return r.status>=200&&r.status<300}catch(e){return false}}
const related=(kb)=>{const out=[];for(let i=0;i<kb.length;i++)for(let j=i+1;j<kb.length;j++){const a=new Set(kb[i].tokens||[]),b=new Set(kb[j].tokens||[]);const sc=E.Sem.dice(a,b);if(sc>=0.22)out.push({a:{id:kb[i].id,title:kb[i].title},b:{id:kb[j].id,title:kb[j].title},score:+sc.toFixed(2)})}return out.sort((x,y)=>y.score-x.score).slice(0,40)};
exports.handler=async(event)=>{const method=event.httpMethod,sub=((event.path||'').split('/learning/')[1]||'').split('?')[0].replace(/\/+$/,''),seg=sub.split('/').filter(Boolean),route=seg[0]||'status';
 if(method==='OPTIONS')return json(204,{});
 const S=ops.stores(event);const PUBLIC=['status','session','patterns','retrieve'];
 if(PUBLIC.includes(route)){
  if(method==='POST'&&!sameOrigin(event))return json(403,{error:'forbidden_origin'});
  if(route==='status'){const a=env('LEARNING_ADMIN_KEY').length>=12;if(!S)return json(200,{configured:false,persistent:false,adminConfigured:a,error:'storage_unavailable'});const st=await ops.settings(S);return json(200,{configured:true,persistent:S.persistent,collect:st.collect,adminConfigured:a})}
  if(!S)return json(503,{error:'storage_unavailable'});
  if(route==='patterns'){if(method!=='GET')return json(405,{error:'method_not_allowed'});const p=await S.meta.get('patterns')||{expr:{},terms:[],behaviours:[]};return json(200,p,{'Cache-Control':'public, max-age=60'})}
  if(!rateLimit(event,'learn-'+route,route==='retrieve'?120:30,60000))return json(429,{error:'rate_limited'});
  const p=parseBody(event,route==='session'?70000:4000);if(p.error)return json(p.error,{error:p.error===413?'too_large':'bad_request'});
  if(route==='retrieve'){const q=String((p.data||{}).q||'').slice(0,400);const hits=await ops.retrieveFor(S,q,3);return json(200,{hits})}
  if(method!=='POST')return json(405,{error:'method_not_allowed'});
  const r=await ops.ingest(S,p.data);if(!r.ok)return json(r.error==='collection_disabled'?202:400,{ok:false,error:r.error});
  if(!r.duplicate){const ok=await trigger(event,r.jobId);if(!ok){try{await ops.processJob(S,r.jobId)}catch(e){}}}
  return json(202,{ok:true,sid:r.sid,duplicate:r.duplicate,persisted:S.persistent})}
 /* ----- admin ----- */
 const a=adminState(event);if(a==='not_configured')return json(503,{error:'admin_not_configured'});if(a!=='ok')return json(401,{error:'unauthorized'});if(!S)return json(503,{error:'storage_unavailable'});
 if(!rateLimit(event,'learn-admin',120,60000))return json(429,{error:'rate_limited'});
 let body={};if(method!=='GET'&&method!=='DELETE'){const p=parseBody(event,400000);if(p.error)return json(p.error,{error:'bad_request'});body=p.data||{}}
 const by='admin',id=seg[1],q=(event.queryStringParameters||{});
 try{
 if(route==='overview')return json(200,await ops.overview(S));
 if(route==='knowledge'){if(method==='GET'){const kb=await ops.readAll(S.kb,'k_');return json(200,{items:kb.map(e=>({...e,tokens:undefined})).sort((x,y)=>String(y.updated).localeCompare(x.updated))})}
  if(method==='POST'&&!id)return json(200,await ops.kbAdd(S,body,by));
  if(method==='PUT'&&id)return json(200,await ops.kbUpdate(S,id,body,by));
  if(method==='DELETE'&&id)return json(200,await ops.kbDelete(S,id,by));
  if(method==='POST'&&id&&seg[2]==='rollback')return json(200,await ops.kbRollback(S,id,body.v,by))}
 if(route==='analyze-text'&&method==='POST')return json(200,{analysis:E.analyzeKnowledge(body.text,body.category||'general')});
 if(route==='records'){if(method==='GET'){let r=await ops.readAll(S.recs,'r_',4000);if(q.category)r=r.filter(x=>x.category===q.category);if(q.status)r=r.filter(x=>x.status===q.status);if(q.q){const s=q.q.toLowerCase();r=r.filter(x=>JSON.stringify([x.summary,x.data]).toLowerCase().includes(s))}r.sort((x,y)=>String(y.updated).localeCompare(x.updated));return json(200,{items:r.slice(0,300).map(x=>({...x,perSession:undefined})),total:r.length})}
  if(method==='POST'&&id==='merge')return json(200,await ops.recMerge(S,body.ids,by));if(method==='PUT'&&id)return json(200,await ops.recSet(S,id,body,by));if(method==='DELETE'&&id)return json(200,await ops.recDelete(S,id,by))}
 if(route==='sessions'){if(method==='GET'&&!id){const s=await ops.readAll(S.sess,'',500);return json(200,{items:s.map(x=>({sid:x.sid,received:x.received,analyzed:x.analyzed||null,learned:x.learned||0,meta:x.meta,turns:x.turns.length})).sort((a1,b1)=>String(b1.received).localeCompare(a1.received))})}
  if(method==='GET'&&id)return json(200,{session:await S.sess.get(id)});if(method==='DELETE'&&id){await ops.deleteSession(S,id,by);return json(200,{ok:true})}}
 if(route==='suggestions'){if(method==='GET'){const s=await ops.readAll(S.sug,'g_',500);return json(200,{items:s.sort((x,y)=>String(y.updated).localeCompare(x.updated))})}if(method==='POST'&&id)return json(200,await ops.sugDecide(S,id,body,by))}
 if(route==='relations'){const recs=await ops.readAll(S.recs,'r_',4000),kb=(await ops.readAll(S.kb,'k_')).filter(e=>e.status!=='rejected');return json(200,{concepts:recs.filter(r=>r.category==='relationship'&&r.count>=1).map(r=>({a:r.data.a,b:r.data.b,sessions:r.count})).sort((x,y)=>y.sessions-x.sessions).slice(0,40),knowledge:related(kb)})}
 if(route==='audit')return json(200,{items:(await ops.readAll(S.audit,'',1500)).sort((x,y)=>String(y.ts).localeCompare(x.ts)).slice(0,200)});
 if(route==='export')return json(200,await ops.exportAll(S));
 if(route==='settings'){if(method==='PUT'){const cur=await ops.settings(S),n={...cur};['collect','autoApproveLowRisk','aiAnalysis'].forEach(k=>{if(typeof body[k]==='boolean')n[k]=body[k]});if(+body.retentionDays>=1&&+body.retentionDays<=3650)n.retentionDays=Math.round(+body.retentionDays);await S.meta.set('settings',n);await ops.audit(S,'settings',JSON.stringify(n),by);return json(200,n)}return json(200,await ops.settings(S))}
 if(route==='jobs'&&method==='POST')return json(200,await ops.retryStale(S));
 if(route==='backup'&&method==='POST')return json(200,await ops.backup(S));
 if(route==='purge'&&method==='POST')return json(200,await ops.purge(S));
 }catch(e){console.error('learning admin error',String(e&&e.message||e).slice(0,120));return json(500,{error:'server_error'})}
 return json(404,{error:'not_found'})};
exports.jobToken=jobToken;
