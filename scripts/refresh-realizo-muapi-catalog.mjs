// Runs on GitHub Actions once per day. This script only reads Muapi's public
// catalog and prepares a D1 snapshot; it NEVER sends a paid generation request.
import {writeFile} from 'node:fs/promises';
import {createPublishedVideoCatalog} from '../lib/realizo-creative/premium-live-models.js';

const destination=process.argv[2];
if(!destination)throw Error('Provide an output SQL file path.');
const API='https://api.muapi.ai/api/v1/models';
let response;
for(let attempt=0;attempt<2;attempt++){
 try{
  response=await fetch(API,{headers:{Accept:'application/json'},
   signal:AbortSignal.timeout(22000),redirect:'error',cache:'no-store'});
  if(response.ok)break;
 }catch(error){if(attempt)throw Error('Muapi catalog request unavailable. Prior snapshot preserved.');}
 if(attempt)throw Error('Muapi catalog HTTP '+response?.status+'. Prior snapshot preserved.');
}
const data=await response.json();
const list=Array.isArray(data.models)?data.models:
 Array.isArray(data.results)?data.results:
 Array.isArray(data.items)?data.items:null;
const snapshot=createPublishedVideoCatalog(list);
const serialized=JSON.stringify(snapshot);
const literal=serialized.replaceAll("'","''");
const sql=[
 '-- No customer data, wallet balance, API key or paid provider request.',
 "CREATE TABLE IF NOT EXISTS realizo_muapi_video_catalog (id TEXT PRIMARY KEY CHECK(id='active'),snapshot_json TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
 "INSERT INTO realizo_muapi_video_catalog(id,snapshot_json,updated_at) VALUES ('active','"+literal+"',datetime('now')) ON CONFLICT(id) DO UPDATE SET snapshot_json=excluded.snapshot_json,updated_at=excluded.updated_at;",
].join('\n');
await writeFile(destination,sql,'utf8');
console.log('Daily Muapi catalog snapshot prepared: '+snapshot.options.length+' compatible new video variants, '+serialized.length+' bytes. No generation submitted.');
