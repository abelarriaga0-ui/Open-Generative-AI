import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HYPERREAL_PRO_VERSION, normalizeHyperrealProBrief,
  planHyperrealProScenes, buildHyperrealProVideoPrompt
} from '../lib/realizo-creative/hyperreal-pro.js';

const product = {
  product_name:'PRISMA Shampoo',description:'Champú de uso cotidiano para el cabello.',
  audience:'Personas adultas en Ecuador',angle:'Rutina de cuidado personal',
  actor:'Hombre adulto con camiseta gris y cabello corto',
  cta:'Escríbenos',duration:30,format:'9:16',speak:true
};

test('hyperreal module remains a dedicated, purely deterministic planner',()=>{
  assert.match(HYPERREAL_PRO_VERSION,/realizo-hyperreal-pro/);
  const shots=planHyperrealProScenes(product);
  assert.equal(shots.length,6);
  assert.deepEqual(shots.map(s=>s.start),[0,5,10,15,20,25]);
  assert.equal(shots.at(-1).end,30);
  assert.equal(shots.at(-1).title,'Cierre y acción');
});
test('different durations produce a complete timeline without invented seconds',()=>{
  for(const seconds of [15,30,45]){
    const shots=planHyperrealProScenes({...product,duration:seconds});
    assert.equal(shots.length,seconds/5);
    assert.equal(shots[0].start,0);
    assert.equal(shots.at(-1).end,seconds);
    assert.ok(shots.every(s=>s.end-s.start===5));
  }
});
test('storyboard preserves product identity, real actor and available speech contract',()=>{
  const text=buildHyperrealProVideoPrompt(product);
  assert.match(text,/PRISMA Shampoo/);
  assert.match(text,/same exact adult actor/i);
  assert.match(text,/label, brand, logo, cap/i);
  assert.match(text,/Latin American Spanish/i);
  assert.match(text,/0-5s/);
  assert.match(text,/25-30s/);
  assert.match(text,/not guaranteed|may not honor|if the model supports/i);
  assert.doesNotMatch(text,/cures|guarantees results/i);
});
test('silent mode explicitly prohibits voice',()=>{
  const prompt=buildHyperrealProVideoPrompt({...product,speak:false});
  assert.match(prompt,/no speech, no voiceover/);
  assert.doesNotMatch(prompt,/SPEECH: the SAME/);
});
test('unverified claims and invalid requests are not manufactured or accepted',()=>{
  assert.throws(()=>normalizeHyperrealProBrief({...product,product_name:''}),/product_details_required/);
  assert.throws(()=>normalizeHyperrealProBrief({...product,duration:18}),/unsupported_hyperreal_duration/);
  const result=normalizeHyperrealProBrief({...product,description:'  Champú  de  uso  diario  '});
  assert.equal(result.description,'Champú de uso diario');
});
