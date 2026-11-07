import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {walletPilotAction} from '../lib/wallet/request-policy.js';

test('Hiperrealista PRO document extraction and video prepare pass through native pilot gateway',()=>{
  for (const path of ['/api/realizo/hyperreal/document','/api/realizo/hyperreal/prepare']) {
    assert.equal(walletPilotAction(path,true,true),'allow',path);
    assert.equal(walletPilotAction(path,true,false),'deny','Legacy pilot must not expose new service: '+path);
    assert.equal(walletPilotAction(path,false,true),'allow','Non-pilot stays unchanged: '+path);
  }
});
test('Hiperrealista permission is EXACT route only; BYOK and unrelated APIs remain blocked',()=>{
  const denied=[
    '/api/realizo/hyperreal','/api/realizo/hyperreal/','/api/realizo/hyperreal/delete',
    '/api/realizo/hyperreal/document/other','/api/realizo/hyperreal/document/debug',
    '/api/realizo/hyperreal/prepare/anything','/api/v1/generate',
    '/api/app','/api/workflow','/api/realizo/unsafe-route'
  ];
  for (const path of denied)assert.equal(walletPilotAction(path,true,true),'deny',path);
});
test('Hiperrealista POST handlers retain native auth, same-origin and document owner isolation',()=>{
  for(const file of [
    'app/api/realizo/hyperreal/document/route.js',
    'app/api/realizo/hyperreal/prepare/route.js'
  ]){
    const source=readFileSync(file,'utf8');
    assert.match(source,/enforceSameOrigin\(request\)/,file);
    assert.match(source,/requireWalletUser\(request,\s*env\)/,file);
  }
  const source=readFileSync('app/api/realizo/hyperreal/document/route.js','utf8');
  assert.match(source,/WHERE user_id=\?/);
  assert.match(source,/document_daily_limit|limit_per_day/);
});
