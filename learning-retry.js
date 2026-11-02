'use strict';
/* Scheduled function (see netlify.toml): retries queued/failed/stale learning jobs, takes a daily backup and applies the retention policy. */
const ops=require('./lib/ops');
exports.handler=async(event)=>{try{const S=ops.stores(event);if(!S)return{statusCode:200,body:'storage_unavailable'};const r=await ops.retryStale(S);let extra={};if(new Date().getUTCHours()===3){extra.backup=await ops.backup(S);extra.purge=await ops.purge(S)}return{statusCode:200,body:JSON.stringify({...r,...extra})}}catch(e){console.error('learning retry error',String(e&&e.message||e).slice(0,120));return{statusCode:500,body:'error'}}};
