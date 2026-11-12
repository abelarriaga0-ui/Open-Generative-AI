import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const wizard=readFileSync('components/RealizoSeedanceFlow.jsx','utf8');
const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
const generate=readFileSync('app/api/wallet/generate/route.js','utf8');

test('new Create video uses only Seedance 2.0 Omni Reference',()=>{
  assert.match(wrapper,/<RealizoSeedanceFlow/);
  assert.match(wizard,/const MODEL_ID='seedance-2-omni-reference'/);
  assert.match(wizard,/images_list:photos\.map/);
  assert.doesNotMatch(wizard,/seedance-2\.5|veo-3|kling-/i);
});
test('user sees sequential questions, explicit quote and deliberate charge',()=>{
  assert.match(wizard,/QUESTIONS=\[/);
  assert.match(wizard,/setStep\(old=>Math\.min\(6,old\+1\)\)/);
  assert.match(wizard,/setStep\(3\)/);
  assert.match(wizard,/setStep\(4\)/);
  assert.match(wizard,/\/api\/wallet\/quote/);
  assert.match(wizard,/\/api\/wallet\/generate/);
  assert.match(wizard,/max_price_cents:quote\.price_cents/);
  assert.match(generate,/idempotency_key/);
  assert.match(quote,/quoteLiveVideo/);
});
test('percentage shown only when MuAPI provides real progress',()=>{
  const status=readFileSync('app/api/wallet/jobs/[id]/route.js','utf8');
  assert.match(status,/provider_progress_percent/);
  assert.match(wizard,/Number\.isInteger\(body\.provider_progress_percent\)/);
  assert.match(wizard,/providerPercent!==null/);
  assert.match(wizard,/porcentaje verificable/);
});
test('image references are required and output is restricted to supported lengths',()=>{
  assert.match(wizard,/photos\.length>=9/);
  assert.match(wizard,/images_list/);
  assert.match(wizard,/if\(step===0 && !photos\.length\)/);
  assert.match(wizard,/\[5,8,10,15\]/);
  assert.match(wizard,/@image1/);
  assert.match(wizard,/NO es un fotograma inicial/);
});
