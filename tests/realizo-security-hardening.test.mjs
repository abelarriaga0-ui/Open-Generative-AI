import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {claimOtpQuota} from '../lib/realizo-auth/email.js';
import {sniffImageMime} from '../lib/realizo-creative/media.js';
import {quoteLiveVideo} from '../lib/wallet/live-video-models.js';
import {contentSecurityPolicy,walletPilotAction} from '../lib/wallet/request-policy.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('OTP quota is atomic and cannot be reset by replacing the challenge',async()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(read('migrations/0037_realizo_auth_rate_buckets.sql'));
  const d1={prepare(sql){return {bind(...args){return {async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}}}};
  const results=await Promise.all(Array.from({length:25},()=>claimOtpQuota(d1,'verify-email','fake-hash',3601,20)));
  assert.equal(results.filter(Boolean).length,20);
  assert.equal(await claimOtpQuota(d1,'verify-email','fake-hash',3602,20),false);
  assert.equal(await claimOtpQuota(d1,'verify-email','fake-hash',7200,20),true);
  assert.equal(await claimOtpQuota(d1,'verify-ip','fake-hash',3602,20),true);
  db.close();
});
test('both paid image upload endpoints validate bytes before forwarding and discard original filename',()=>{
  for(const p of ['app/api/conversion-templates/upload/route.js','app/api/realizo/images/upload/route.js']){
    const src=read(p);
    assert.match(src,/sniffImageMime\(bytes\)\s*!==\s*file\.type/);
    assert.ok(src.indexOf('sniffImageMime(bytes)')<src.indexOf("fetch('https://api.muapi.ai/api/v1/upload_file'"));
    assert.doesNotMatch(src,/file\.name/);
  }
  assert.equal(sniffImageMime(new TextEncoder().encode('not an image')),null);
});
test('webhook refuses invalid signatures before settlement',()=>{
  const src=read('app/api/wallet/paypal/webhook/route.js');
  assert.match(src,/verification\.data\.verification_status !== 'SUCCESS'/);
  assert.ok(src.indexOf('unverified_webhook')<src.indexOf('await settlePaypalOrder'));
});

test('negative billing inputs fail before any provider request',async()=>{
  const previous=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('unexpected_network')};
  try{
    for(const input of [{duration:-5},{duration:'-5s'},{duration:0},{quantity:-1},{num_outputs:0},{batch_size:1.5}]){
      await assert.rejects(quoteLiveVideo('kling-3',{prompt:'test',...input}),/invalid_generation_request/);
    }
    assert.equal(calls,0);
  }finally{globalThis.fetch=previous;}
});
test('conversion template can use only uploads recorded for authenticated owner',()=>{
  const upload=read('app/api/conversion-templates/upload/route.js');
  const generate=read('app/api/conversion-templates/generate/route.js');
  assert.match(upload,/INSERT INTO realizo_image_uploads\(id,user_id,image_url\)/);
  assert.match(generate,/WHERE user_id=\? AND image_url=\?/);
  assert.match(generate,/\.bind\(user\.id,body\.product_url\)/);
  assert.ok(generate.indexOf('if(!ownedUpload)')<generate.indexOf('await createReservedJob'));
});
test('wallet mode denies legacy admin API and restricts browser embedding',()=>{
  assert.equal(walletPilotAction('/api/admin',true,true),'deny');
  assert.equal(walletPilotAction('/admin',true,true),'redirect');
  const csp=contentSecurityPolicy('/studio');
  for(const rule of ["object-src 'none'","base-uri 'self'","frame-ancestors 'none'"])assert.ok(csp.includes(rule));
});
