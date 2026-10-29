import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walletPilotAction } from '../lib/wallet/request-policy.js';

test('native Sandbox routes to video studio but preserves blocked BYOK APIs',()=>{
  for (const path of ['/studio','/studio/','/studio/video','/studio/video/'])
    assert.equal(walletPilotAction(path,true,true),'allow',path);
  for (const path of ['/api/v1/models','/api/app','/api/workflow','/api/upload-binary'])
    assert.equal(walletPilotAction(path,true,true),'deny',path);
  for (const path of ['/studio/image','/studio/apps','/studio/workflows'])
    assert.equal(walletPilotAction(path,true,true),'redirect',path);
});
test('legacy Wallet Sandbox still does not expose full studio',()=>{
  assert.equal(walletPilotAction('/studio',true),'redirect');
  assert.equal(walletPilotAction('/studio/video',true),'redirect');
  assert.equal(walletPilotAction('/api/v1',true),'deny');
  assert.equal(walletPilotAction('/studio/video',false),'allow');
});
test('Google and email redirects target video studio instead of wallet',()=>{
  const google=readFileSync('app/auth/google/callback/route.js','utf8');
  const email=readFileSync('app/login/page.jsx','utf8');
  assert.match(google,/new URL\('\/studio',env.REALIZO_AUTH_ORIGIN\)/);
  assert.match(email,/router.replace\('\/studio'\)/);
  assert.doesNotMatch(google,/new URL\('\/wallet'/);
});
test('first party studio requires authenticated D1 session before rendering original editor',()=>{
  const s=readFileSync('app/studio/[[...slug]]/page.js','utf8');
  assert.match(s,/getOwnSession\(env\)/);
  assert.match(s,/if \(!user\) redirect\('\/login'\)/);
  assert.match(s,/RealizoStudio accountId=\{user.id\}/);
  const editor=readFileSync('components/RealizoStudio.jsx','utf8');
  assert.match(editor,/VideoStudio/);
  assert.match(editor,/persistenceScope=\{accountId\}/);
  assert.match(editor,/previewOnly/);
});
test('original video studio remains in place, no client BYOK key or paid requests enabled',()=>{
  const video=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
  assert.match(video,/persistenceScope/);
  assert.match(video,/disabled=\{\(previewOnly && !\(generationReady && billableModelIds.includes\(selectedModel\)\)\)/);
  const env=JSON.parse(readFileSync('wrangler.auth-sandbox.jsonc','utf8'));
  assert.equal(env.vars.REALIZO_ENV,'sandbox');
  assert.equal(env.vars.MUAPI_GENERATION_ENABLED,'true');
  assert.equal(env.vars.REALIZO_MUAPI_PILOT,'true');
  assert.equal(env.vars.REALIZO_MUAPI_PILOT_ACCOUNT_ID,undefined);
});
