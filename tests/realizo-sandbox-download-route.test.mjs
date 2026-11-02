import test from 'node:test';
import assert from 'node:assert/strict';
import {walletPilotAction} from '../lib/wallet/request-policy.js';
import {readFileSync} from 'node:fs';

const owned='/api/realizo/jobs/21797787-63de-48e3-b895-06396b1e55a9/download';

test('native Sandbox lets the owner-authorized POST download reach its route',()=>{
 assert.equal(walletPilotAction(owned,true,true),'allow');
 assert.equal(walletPilotAction(owned+'/',true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/jobs',true,true),'allow');
 const route=readFileSync('app/api/realizo/jobs/[id]/download/route.js','utf8');
 assert.match(route,/export async function POST\(request/);
 assert.match(route,/requireWalletUser\(request,env\)/);
 assert.match(route,/getGenerationJob\(env\.WALLETS_DB,user\.id,id\)/);
 assert.match(route,/extractOwnedDownloadUrl\(job\)/);
});
test('wallet-only policy still blocks all other nested generation-job routes',()=>{
 const denied=[
  '/api/realizo/jobs/21797787-63de-48e3-b895-06396b1e55a9',
  '/api/realizo/jobs/21797787-63de-48e3-b895-06396b1e55a9/delete',
  '/api/realizo/jobs/not-a-valid-id/download',
  '/api/realizo/jobs/21797787-63de-48e3-b895-06396b1e55a9/download/other',
  '/api/realizo/jobs/21797787-63de-48e3-b895-06396b1e55a9/download.mp4',
  '/api/realizo/admin',
 ];
 for(const url of denied)assert.equal(walletPilotAction(url,true,true),'deny',url);
 assert.equal(walletPilotAction(owned,true,false),'deny');
});
test('download URL path is the same used by the client',()=>{
 const client=readFileSync('lib/realizo-creative/download-video.js','utf8');
 assert.match(client,/\/api\/realizo\/jobs\//);
 assert.match(client,/encodeURIComponent\(jobId\)/);
 assert.match(client,/\/download/);
 assert.match(client,/method:'POST'/);
});
