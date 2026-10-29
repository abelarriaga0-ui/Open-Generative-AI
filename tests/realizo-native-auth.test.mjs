import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalEmail,randomToken,sha256,hmacHex,assertOwnAuthConfig,sameOrigin} from '../lib/realizo-auth/crypto.js';
import {googleEnabled,verifyGoogleIdToken} from '../lib/realizo-auth/google.js';
import {emailEnabled} from '../lib/realizo-auth/email.js';
import {walletPilotAction} from '../lib/wallet/request-policy.js';
import {isMuapiGenerationEnabled} from '../lib/wallet/generation-policy.js';
import {readFileSync} from 'node:fs';

test('email normalized safely and invalid inputs rejected',()=>{
  assert.equal(canonicalEmail('  User@Example.COM '),'user@example.com');
  for(const s of ['',null,4,'abc','example.com','a @b.com','x'.repeat(255)+'@x.com'])assert.equal(canonicalEmail(s),null);
});
test('session token random, strong and only hashed value stored',async()=>{
  const a=randomToken(),b=randomToken();assert.notEqual(a,b);
  assert.match(a,/^[A-Za-z0-9_-]{40,128}$/);
  assert.equal((await sha256(a)).length,64);
  assert.notEqual(await sha256(a),a);
  const h=await hmacHex('s'.repeat(32),'account+code');
  assert.equal(h.length,64);assert.notEqual(h,await hmacHex('s'.repeat(32),'account+wrong'));
});
test('native login must be explicitly enabled and secrets present',()=>{
  assert.throws(()=>assertOwnAuthConfig({REALIZO_AUTH_PROVIDER:'native'}));
  assert.throws(()=>assertOwnAuthConfig({REALIZO_AUTH_PROVIDER:'cloudflare',REALIZO_AUTH_PEPPER:'x'.repeat(32)}));
  assert.doesNotThrow(()=>assertOwnAuthConfig({REALIZO_AUTH_PROVIDER:'native',REALIZO_AUTH_PEPPER:'x'.repeat(32)}));
  assert.equal(emailEnabled({}),false);assert.equal(googleEnabled({}),false);
});
test('only the configured same-origin browser can send login requests',()=>{
  const env={REALIZO_AUTH_ORIGIN:'https://realizo-auth-sandbox.abelarriaga0.workers.dev'};
  const url=env.REALIZO_AUTH_ORIGIN+'/api/auth/email/start';
  assert.equal(sameOrigin(new Request(url,{headers:{origin:env.REALIZO_AUTH_ORIGIN}}),env),true);
  assert.equal(sameOrigin(new Request(url,{headers:{origin:'https://phishing.example'}}),env),false);
  assert.equal(sameOrigin(new Request(url),env),false);
});
test('Google claims without verified cryptographic JWT never authorize a wallet',async()=>{
  assert.equal(await verifyGoogleIdToken('garbage','client','nonce'),null);
  assert.equal(await verifyGoogleIdToken('a.b.c','client','nonce'),null);
});
test('pilot permits own auth UI but blocks every legacy Muapi proxy',()=>{
  for(const p of ['/login','/create','/auth/google/callback',
    '/api/auth/google/start','/api/auth/email/verify','/api/auth/logout'])
    assert.equal(walletPilotAction(p,true),'allow',p);
  for(const p of ['/api/app','/api/v1/text-to-video','/api/workflow'])
    assert.equal(walletPilotAction(p,true),'deny',p);
});
test('new Worker is isolated and cannot use real money or provider credits',()=>{
  const c=JSON.parse(readFileSync('wrangler.auth-sandbox.jsonc','utf8'));
  assert.equal(c.name,'realizo-auth-sandbox');
  assert.equal(c.vars.REALIZO_AUTH_PROVIDER,'native');
  assert.equal(c.vars.PAYPAL_MODE,'sandbox');
  assert.equal(c.vars.MUAPI_GENERATION_ENABLED,'false');
  assert.equal(isMuapiGenerationEnabled(c.vars),false);
  assert.equal(c.vars.PAYPAL_CLIENT_SECRET,undefined);
  assert.equal(c.vars.MUAPI_API_KEY,undefined);
});
