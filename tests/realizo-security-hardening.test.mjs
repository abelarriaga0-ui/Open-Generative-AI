import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {claimOtpQuota} from '../lib/realizo-auth/email.js';
import {sniffImageMime} from '../lib/realizo-creative/media.js';
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
