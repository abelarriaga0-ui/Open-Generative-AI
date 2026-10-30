import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractGeneratedVideoUrl} from '../lib/realizo-creative/wallet-generation.js';
import {walletPilotAction} from '../lib/wallet/request-policy.js';
import {readFileSync} from 'node:fs';
test('wallet generator supports provider response shapes without sending BYOK credentials',()=>{
 assert.equal(extractGeneratedVideoUrl({result:{url:'https://media.example/video.mp4'}}),'https://media.example/video.mp4');
 assert.equal(extractGeneratedVideoUrl({result:{outputs:[{url:'https://media.example/video2.mp4'}]}}),'https://media.example/video2.mp4');
 assert.equal(extractGeneratedVideoUrl({result:{outputs:['javascript:bad']}}),null);
 const wallet=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(wallet,/\/api\/wallet\/generate/);
 assert.match(wallet,/\/api\/wallet\/jobs\//);
 assert.doesNotMatch(wallet,/api\.muapi\.ai|x-api-key|MUAPI_API_KEY/);
});
test('native account only can view its videos; unknown APIs blocked by proxy',()=>{
 assert.equal(walletPilotAction('/api/realizo/jobs',true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/jobs',true,false),'deny');
 assert.equal(walletPilotAction('/api/realizo/jobs/secret',true,true),'deny');
 const api=readFileSync('app/api/realizo/jobs/route.js','utf8');
 assert.match(api,/WHERE user_id=\?/);
 assert.match(api,/requireWalletUser/);
 assert.doesNotMatch(api,/searchParams\.get\(['"]user_id/);
});
test('original multi-model picker remains available while paid requests require wallet readiness',()=>{
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(editor,/previewOnly && !generationReady/);
 assert.match(editor,/onWalletGenerate && generationReady/);
 assert.doesNotMatch(editor,/selectedModel!==id \|\| !imageMode/);
 const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
 assert.match(wrapper,/setGenerationReady\(Boolean\(x\?\.generation_enabled &&/);
 assert.match(wrapper,/Elige tu modelo, duración y resolución/);
 const flags=JSON.parse(readFileSync('wrangler.auth-sandbox.jsonc','utf8')).vars;
 assert.equal(flags.REALIZO_MULTI_MODEL_SANDBOX,'true');
 assert.equal(flags.REALIZO_MUAPI_PILOT_ACCOUNT_ID,undefined);
});
test('dynamic quote must be accepted by user before creating an expense',()=>{
 const bridge=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(bridge,/\/api\/wallet\/quote/);
 assert.match(bridge,/window\.confirm/);
 assert.match(bridge,/max_price_cents:quote\.price_cents/);
 assert.doesNotMatch(bridge,/Number\(inputs\.duration\)!==5/);
 assert.doesNotMatch(bridge,/MUAPI_API_KEY/);
 const server=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(server,/quoteLiveVideo/);
 assert.match(server,/quote\.provider_cost_cents>body\.max_price_cents/);
 assert.match(server,/isOwnerMultiModelSandbox/);
 assert.match(server,/!multiModel/);
});
