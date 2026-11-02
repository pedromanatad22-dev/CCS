'use strict';
/* Learning engine: privacy filtering, session analysis, knowledge validation, consolidation, retrieval. Pure logic + store operations. */
const crypto=require('crypto');
const Sem=require('../../../semantic.js');
const H=s=>crypto.createHash('sha1').update(String(s)).digest('hex').slice(0,12);
const now=()=>new Date().toISOString();
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const norm=t=>Sem.tokens(t).join(' ');
const CATS=['terminology','definition','sentence_structure','equivalent_question','customer_pattern','customer_emotion','problem_solving','verification_pattern','scenario_insight','knowledge_gap','agent_mistake','successful_technique','suggested_improvement','relationship','policy_statement'];
/* ---------- privacy ---------- */
function redact(text,facts){let t=String(text||'');
 t=t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g,'[EMAIL]').replace(/\b(?:\d[ -]?){12,18}\d\b/g,'[CARD]').replace(/\b(?:password|passcode|pin|cvv|cvc)\b\s*(?:is|:)?\s*\S+/gi,'[SECRET]').replace(/(\+?\d[\d\s().-]{7,}\d)/g,'[PHONE]').replace(/\b[A-Z]{1,2}\d{6,9}\b/g,'[ID]');
 ((facts&&facts.refs)||[]).filter(Boolean).forEach(r=>{t=t.replace(new RegExp(esc(r),'gi'),'[REF]')});
 ((facts&&facts.names)||[]).filter(Boolean).forEach(n=>String(n).split(/\s+/).filter(w=>w.length>2).forEach(w=>{t=t.replace(new RegExp('\\b'+esc(w)+'\\b','gi'),'[NAME]')}));
 return t}
const str=(v,n)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
function cleanSession(p){if(!p||typeof p!=='object')return null;const m=p.meta||{},facts=p.privacy||{};const turns=(Array.isArray(p.turns)?p.turns:[]).slice(0,90).map((z,i)=>({i,r:z&&z.r==='C'?'C':'A',t:redact(str(z&&z.t,400),facts),topics:(Array.isArray(z&&z.topics)?z.topics:[]).slice(0,6).map(x=>str(x,12)),emo:typeof(z&&z.emo)==='number'&&isFinite(z.emo)?Math.max(0,Math.min(10,z.emo)):null,un:!!(z&&z.un)})).filter(z=>z.t);
 if(turns.length<2)return null;
 return{sid:str(p.sid,64)||('s_'+H(JSON.stringify(turns).slice(0,300)+Date.now())),received:now(),
  meta:{sit:str(m.sit,24),label:str(m.label,80),type:str(m.type,4),personality:str(m.personality,60),diff:str(m.diff,12),mood:str(m.mood,4),outcome:str(m.outcome,24),duration:Math.max(0,Math.min(7200,+m.duration||0)),training:!!m.training,workspace:str(m.workspace,60),level:str(m.level,12),startEmotion:str(m.startEmotion,16),stats:{misquote:+((m.stats||{}).misquote)||0,interrupt:+((m.stats||{}).interrupt)||0,repeats:+((m.stats||{}).repeats)||0,rude:!!((m.stats||{}).rude),dismiss:!!((m.stats||{}).dismiss)}},
  vt:Object.fromEntries(Object.entries(p.vt||{}).slice(0,12).map(([k,v])=>[str(k,16),str(v,12)])),turns}}
/* ---------- moves ---------- */
const MOVES=[['dismissive',/(not my problem|nothing (i|we) can do|can.?t help you|that.?s the policy|calm down|you should have|your fault|just wait|i already (told|explained)|whatever|as i said)/],['empathy',/(sorry|apolog|understand|frustrat|inconvenien|appreciate|i can imagine|that must)/],['solution',/(i can (offer|rebook|check|help)|let me (check|look|find|see)|alternative|rebook|option|i.?ll (check|arrange|book))/],['explanation',/(because|the reason|this means|what (that|this) means|in other words|step by step|first,|next,)/],['verification',/(your name|booking reference|confirmation (code|number)|date of travel|flight number|where are you|which flight)/],['closing',/(anything else|thank you for calling|have a (great|safe|nice))/]];
const moveOf=t=>{const x=String(t||'').toLowerCase();return MOVES.filter(m=>m[1].test(x)).map(m=>m[0])};
const POLICY=/(policy|fee|charge|refund|free of charge|non-?refundable|allowed|not allowed|entitled|voucher|compensation|hotel|meal|waive|penalty|deadline|within \d+ (hours|days))/i;
const neg=t=>/\b(not|no|never|cannot|can.?t|isn.?t|aren.?t|won.?t|unable|non-?refundable|without)\b/i.test(t);
const TERMS=['pnr','itinerary','rebooking','voucher','involuntary','layover','codeshare','standby','no-show','fare difference','change fee','manifest','e-ticket','ticket number','boarding pass','gate','irregular operations','schedule change','denied boarding','unaccompanied minor','special assistance','wheelchair','baggage tag','delayed baggage','connection','misconnect','reissue','refund','travel credit'];
/* ---------- validation against approved knowledge ---------- */
function checkClaim(sentence,kb){const tk=new Set(Sem.tokens(sentence));let best=null;(kb||[]).forEach(e=>{if(e.status!=='approved')return;Sem.sentences(e.content).forEach(s=>{const sc=Sem.dice(tk,new Set(Sem.tokens(s)));if(sc>=0.45&&(!best||sc>best.sc))best={sc,s,id:e.id,title:e.title}})});
 if(!best)return{verdict:'unverified'};return neg(sentence)===neg(best.s)?{verdict:'supported',by:best}:{verdict:'conflict',by:best}}
/* ---------- session analysis ---------- */
function analyze(sess,kb){const obs=[],M=sess.meta,pk=(M.personality||M.type||'?').toLowerCase(),turns=sess.turns,sid=sess.sid;
 const add=o=>obs.push(Object.assign({sid,conf:0.5,cls:'B'},o));
 const asked={};
 turns.forEach((z,i)=>{if(z.r!=='A')return;Sem.sentences(z.t).forEach(s=>{const isQ=/\?\s*$/.test(s)||/\b(may i|could you|can you|would you|please (tell|provide|give)|let me know)\b/i.test(s);if(!isQ)return;const c=Sem.classify(s),n=norm(s);if(!n)return;
   if(c.field){asked[c.field]=(asked[c.field]||0)+1;if(c.score<0.999||!z.topics.length)add({key:'eq:'+c.field+':'+n,category:'equivalent_question',summary:'"'+s+'" means '+c.field,data:{field:c.field,expr:s.replace(/\s+/g,' ').trim(),norm:n},val:{n:1},conf:Math.min(0.95,c.score)})}
   else if(z.un||(!z.topics.length&&sess.turns[i+1]&&sess.turns[i+1].r==='C'&&/(what do you mean|sorry\?|i don.?t understand|can you repeat)/i.test(sess.turns[i+1].t)))add({key:'gap:'+n,category:'knowledge_gap',cls:'C',summary:'Agent question not recognised: "'+s+'"',data:{expr:s,norm:n},val:{n:1},conf:0.6})});
  if(POLICY.test(z.t))Sem.sentences(z.t).filter(s=>POLICY.test(s)&&!/\?\s*$/.test(s)&&s.length>25).slice(0,2).forEach(s=>{const v=checkClaim(s,kb);add({key:'pol:'+norm(s),category:'policy_statement',cls:v.verdict==='conflict'?'D':'C',summary:'Agent stated: "'+s+'"',data:{text:s,verdict:v.verdict,by:v.by&&v.by.title,byId:v.by&&v.by.id},val:{n:1},conf:v.verdict==='supported'?0.8:0.3,status:v.verdict==='conflict'?'rejected':'pending'})});
  TERMS.forEach(w=>{if(new RegExp('\\b'+esc(w)+'\\b','i').test(z.t))add({key:'term:'+w,category:'terminology',summary:'Domain term used: '+w,data:{term:w},val:{n:1},conf:0.5})})});
 /* emotion reactions */
 let prevEmo=turns.find(z=>z.r==='C'&&z.emo!=null),agentMoves=[];
 turns.forEach((z,i)=>{if(z.r==='A'){agentMoves=moveOf(z.t);return}if(z.emo==null||z===prevEmo){return}const d=z.emo-prevEmo.emo;agentMoves.forEach(mv=>{add({key:'emo:'+pk+':'+mv,category:'customer_emotion',summary:mv+' with a '+pk+' customer',data:{personality:pk,move:mv},val:{n:1,sum:d},conf:0.5})});prevEmo=z});
 /* mistakes and techniques */
 Object.entries(asked).filter(([f,n])=>n>=2).forEach(([f])=>add({key:'mistake:repeat:'+f,category:'agent_mistake',summary:'Asked for '+f+' more than once',data:{type:'repeated_question',field:f},val:{n:1},conf:0.7}));
 if(turns.some(z=>z.r==='A'&&MOVES[0][1].test(z.t.toLowerCase())))add({key:'mistake:dismissive',category:'agent_mistake',summary:'Used dismissive language',data:{type:'dismissive'},val:{n:1},conf:0.8});
 if(M.stats.misquote)add({key:'mistake:misquote',category:'agent_mistake',summary:'Quoted a fare that did not match the screen',data:{type:'misquote'},val:{n:1},conf:0.8});
 if(M.mood!=='-1'&&/upset|1/.test(String(M.mood)+String(M.startEmotion))&&!turns.some(z=>z.r==='A'&&/(sorry|understand|apolog)/i.test(z.t)))add({key:'mistake:no-empathy',category:'agent_mistake',summary:'No empathy shown to an upset customer',data:{type:'no_empathy'},val:{n:1},conf:0.6});
 if(M.outcome==='satisfied'){const used=new Set();turns.filter(z=>z.r==='A').forEach(z=>moveOf(z.t).forEach(m=>used.add(m)));used.forEach(m=>{if(m!=='dismissive'&&m!=='closing')add({key:'tech:'+pk+':'+m,category:'successful_technique',summary:m+' was part of a satisfying call ('+pk+')',data:{personality:pk,move:m},val:{n:1},conf:0.5})})}
 const seq=[];turns.filter(z=>z.r==='A').forEach(z=>{const m=moveOf(z.t)[0];if(m&&seq[seq.length-1]!==m)seq.push(m)});if(seq.length>=3)add({key:'ps:'+M.sit+':'+seq.slice(0,6).join('>'),category:'problem_solving',summary:'Call flow ('+M.sit+'): '+seq.slice(0,6).join(' > ')+' ('+(M.outcome||'?')+')',data:{sit:M.sit,flow:seq.slice(0,6),outcome:M.outcome},val:{n:1},conf:0.5});
 add({key:'scn:'+M.sit+':'+pk+':'+M.diff,category:'scenario_insight',summary:M.label+' / '+pk+' / '+M.diff+' outcomes',data:{sit:M.sit,personality:pk,diff:M.diff,outcome:M.outcome},val:{n:1,sum:M.duration,out:M.outcome},conf:0.5});
 const cust=turns.filter(z=>z.r==='C').map(z=>z.t.toLowerCase()).join(' ');const rel=['cancel','refund','rebook','delay','baggage','alternative','missed','name'].filter(w=>cust.includes(w)||turns.some(z=>z.r==='A'&&z.t.toLowerCase().includes(w)));for(let a=0;a<rel.length;a++)for(let b=a+1;b<rel.length;b++)add({key:'rel:'+rel[a]+':'+rel[b],category:'relationship',summary:rel[a]+' relates to '+rel[b],data:{a:rel[a],b:rel[b]},val:{n:1},conf:0.4});

 const g=new Map();obs.forEach(o=>{const k=o.key;if(!g.has(k)){g.set(k,Object.assign({},o,{val:Object.assign({},o.val)}))}else{const a=g.get(k);a.val.n=(a.val.n||1)+(o.val.n||1);if(o.val.sum!=null)a.val.sum=(a.val.sum||0)+o.val.sum;a.conf=Math.max(a.conf,o.conf)}});
 return[...g.values()]}
/* ---------- consolidation ---------- */
function agg(r){const v=Object.values(r.perSession||{});return{count:v.length,n:v.reduce((a,x)=>a+(x.n||1),0),sum:v.reduce((a,x)=>a+(+x.sum||0),0)}}
function recompute(r){const a=agg(r);r.count=a.count;r.sources=Object.keys(r.perSession||{});r.n=a.n;r.sum=a.sum;const avg=a.n?a.sum/a.n:0;
 if(r.category==='customer_emotion'){r.summary=r.data.move+' with a '+r.data.personality+' customer: average change '+(avg>=0?'+':'')+avg.toFixed(2)+' ('+(avg>0.3?'more frustrated':avg<-0.3?'calmer':'no clear effect')+') over '+a.n+' reactions';r.data.avg=+avg.toFixed(2)}
 if(r.category==='scenario_insight'){const o={};Object.values(r.perSession).forEach(x=>{if(x.out)o[x.out]=(o[x.out]||0)+1});r.data.outcomes=o}
 let conf=Math.min(0.95,0.4+0.1*a.count);if(r.category==='equivalent_question')conf=Math.min(0.95,Math.max(r.confidence||0,0.45+0.12*a.count));r.confidence=+conf.toFixed(2);
 if(!r.manual){if(r.status==='rejected'&&r.cls==='D')return r;
  if(r.category==='equivalent_question')r.status=a.count>=2&&r.confidence>=0.6?'auto':'observed';
  else if(r.category==='customer_emotion')r.status=a.n>=5&&Math.abs(avg)>=0.4?'auto':'observed';
  else if(r.category==='policy_statement')r.status=r.cls==='D'?'rejected':'pending';
  else if(r.category==='knowledge_gap')r.status='pending';
  else r.status='observed'}
 return r}
const usable=r=>r&&(r.status==='auto'||r.status==='approved');
/* ---------- retrieval (semantic-lexical RAG over approved knowledge + validated patterns) ---------- */
function idfWeights(docs){const df={};docs.forEach(d=>new Set(d).forEach(w=>df[w]=(df[w]||0)+1));const n=docs.length||1;return w=>Math.log(1+n/(df[w]||1))}
function retrieve(query,entries,records,k){const q=new Set(Sem.tokens(query));if(!q.size)return[];const cand=[];
 (entries||[]).filter(e=>e.status==='approved').forEach(e=>cand.push({kind:'knowledge',id:e.id,title:e.title,text:e.content,tk:e.tokens&&e.tokens.length?e.tokens:Sem.tokens(e.title+' '+e.content)}));
 (records||[]).filter(usable).filter(r=>r.category==='customer_emotion'||r.category==='successful_technique'||r.category==='problem_solving').forEach(r=>cand.push({kind:'behaviour',id:r.id,title:r.category,text:r.summary,tk:Sem.tokens(r.summary)}));
 const w=idfWeights(cand.map(c=>c.tk));return cand.map(c=>{const set=new Set(c.tk);let sc=0,tot=0;q.forEach(x=>{const wt=w(x);tot+=wt;if(set.has(x))sc+=wt});return{c,sc:tot?sc/tot:0}}).filter(x=>x.sc>=0.34).sort((a,b)=>b.sc-a.sc).slice(0,k||3).map(x=>({kind:x.c.kind,id:x.c.id,title:x.c.title,text:String(x.c.text).slice(0,320),score:+x.sc.toFixed(2)}))}
function patterns(entries,records){const expr={};const add=(f,e)=>{(expr[f]=expr[f]||[]);if(!expr[f].includes(e)&&expr[f].length<60)expr[f].push(e)};
 (records||[]).filter(usable).filter(r=>r.category==='equivalent_question').forEach(r=>add(r.data.field,r.data.expr));
 (entries||[]).filter(e=>e.status==='approved').forEach(e=>((e.analysis||{}).questions||[]).forEach(q=>q.field&&add(q.field,q.text)));
 const terms=[];(entries||[]).filter(e=>e.status==='approved').forEach(e=>((e.analysis||{}).terms||[]).forEach(t=>terms.push(t)));
 const behaviours=(records||[]).filter(usable).filter(r=>r.category==='customer_emotion'&&Math.abs(r.data.avg||0)>=0.4).slice(0,12).map(r=>({personality:r.data.personality,move:r.data.move,avg:r.data.avg,n:r.n}));
 return{expr,terms:terms.slice(0,80),behaviours,ts:now()}}
/* ---------- admin knowledge analysis ---------- */
function analyzeKnowledge(text,category){const t=String(text||''),sents=Sem.sentences(t),out={terms:[],questions:[],policies:[],steps:[],keywords:[]};
 sents.forEach(s=>{let m=s.match(/^["“]?([A-Za-z][\w\- ]{1,40}?)["”]?\s*(?:means|is defined as|refers to|is when|:|=|-)\s+(.{8,200})$/i);if(m&&m[1].split(/\s+/).length<=5&&!/\?/.test(s))out.terms.push({term:m[1].trim(),def:m[2].trim()});
  if(/\?\s*$/.test(s)||category==='phrase'){const c=Sem.classify(s);out.questions.push({text:s.replace(/\s+/g,' '),field:c.field||null,score:+(c.score||0).toFixed(2)})}
  if(POLICY.test(s)&&!/\?\s*$/.test(s))out.policies.push(s);if(/^\s*(\d+[.)]|step\s*\d+|[-*•])\s+/i.test(s))out.steps.push(s.replace(/^\s*(\d+[.)]|step\s*\d+|[-*•])\s+/i,''))});
 const freq={};Sem.tokens(t).forEach(w=>freq[w]=(freq[w]||0)+1);out.keywords=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0]);return out}
module.exports={H,now,norm,redact,cleanSession,analyze,recompute,agg,usable,retrieve,patterns,analyzeKnowledge,checkClaim,moveOf,CATS,Sem};
