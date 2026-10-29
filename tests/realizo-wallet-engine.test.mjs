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
test('paid model unlock requires both wallet server readiness and matching model price',()=>{
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(editor,/previewOnly && !\(generationReady && billableModelIds.includes\(selectedModel\)\)/);
 assert.match(editor,/onWalletGenerate && generationReady/);
 const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
 assert.match(wrapper,/setGenerationReady\(Boolean\(x\?\.generation_enabled\)\)/);
 const flags=JSON.parse(readFileSync('wrangler.auth-sandbox.jsonc','utf8')).vars;
 assert.equal(flags.MUAPI_GENERATION_ENABLED,'false');
});
