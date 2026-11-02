'use strict';
/* Netlify BACKGROUND function (the "-background" suffix): returns 202 immediately and keeps analysing a completed session.
   Only the learning API can start it (HMAC token), and it only processes jobs that already exist in storage. */
const ops=require('./lib/ops');const{jobToken}=require('./learning');
exports.handler=async(event)=>{try{const tok=(event.headers||{})['x-learn-job']||'';const{jobId}=JSON.parse(event.body||'{}');if(!jobId||tok!==jobToken(jobId))return{statusCode:401,body:'unauthorized'};const S=ops.stores(event);if(!S)return{statusCode:503,body:'storage_unavailable'};await ops.processJob(S,jobId);return{statusCode:200,body:'ok'}}catch(e){console.error('background learning error',String(e&&e.message||e).slice(0,120));return{statusCode:500,body:'error'}}};
