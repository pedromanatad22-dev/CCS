'use strict';
/* Storage adapter. Production = Netlify Blobs (persistent, shared by every device that uses the site).
   Tests inject an in-memory factory. If neither is available the engine reports persistent:false and never claims to have saved. */
let injected=null;
function setFactory(f){injected=f}
function memFactory(){const db={};const f=name=>{db[name]=db[name]||new Map();const m=db[name];return{async get(k){return m.has(k)?JSON.parse(m.get(k)):null},async set(k,v){m.set(k,JSON.stringify(v))},async del(k){m.delete(k)},async list(p){return[...m.keys()].filter(k=>!p||k.startsWith(p))}}};f.persistent=false;f._db=db;return f}
function blobs(event){let b;try{b=require('@netlify/blobs')}catch(e){return null}
 try{if(event&&b.connectLambda)b.connectLambda(event)}catch(e){}
 return name=>{const st=b.getStore({name,consistency:'strong'});return{async get(k){return await st.get(k,{type:'json'})},async set(k,v){await st.setJSON(k,v)},async del(k){await st.delete(k)},async list(p){const out=[];const r=await st.list({prefix:p||''});for(const x of(r.blobs||[]))out.push(x.key);return out}}}}
function open(event){if(injected)return{open:injected,persistent:injected.persistent!==false};const f=blobs(event);return f?{open:f,persistent:true}:{open:null,persistent:false}}
module.exports={open,setFactory,memFactory};
