import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {recordSecurityEvent} from '../lib/wallet/security-events.js';
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

test('security events use atomic aggregate counters with no personal data',async()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(read('migrations/0038_realizo_security_events.sql'));
  const d1={prepare(sql){return {bind(...args){return {async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}}}};
  await recordSecurityEvent({WALLETS_DB:d1},'login_failed');
  await recordSecurityEvent({WALLETS_DB:d1},'login_failed');
  await recordSecurityEvent({WALLETS_DB:d1},'not_allowed');
  assert.equal(db.prepare('SELECT event_count FROM realizo_security_events WHERE event_type=?').get('login_failed').event_count,2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM realizo_security_events').get().n,1);
  db.close();
});
test('isolated SQLite backup restores synthetic account and security counters',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'realizo-restore-'));
  const source=new DatabaseSync(':memory:');
  try{
    source.exec(read('migrations/0003_realizo_identity.sql'));
    source.exec(read('migrations/0038_realizo_security_events.sql'));
    source.prepare('INSERT INTO realizo_accounts(id,email) VALUES(?,?)').run('synthetic','fixture@example.invalid');
    source.prepare('INSERT INTO realizo_security_events VALUES(?,?,?)').run(3600,'login_failed',2);
    await backup(source,join(dir,'restore.sqlite'));
    const restored=new DatabaseSync(join(dir,'restore.sqlite'));
    try{
      assert.equal(restored.prepare('SELECT COUNT(*) AS n FROM realizo_accounts').get().n,1);
      assert.equal(restored.prepare('SELECT event_count FROM realizo_security_events').get().event_count,2);
      assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }finally{restored.close();}
  }finally{source.close();rmSync(dir,{recursive:true,force:true});}
});
test('server account creation cannot mass assign browser roles or permissions',()=>{
  const src=read('lib/realizo-auth/accounts.js');
  const route=read('app/api/auth/email/verify/route.js');
  assert.match(src,/INSERT OR IGNORE INTO realizo_accounts \(id,email\) VALUES \(\?,\?\)/);
  assert.match(route,/findOrCreateAccount\(env\.WALLETS_DB,email,'email',email\)/);
});
