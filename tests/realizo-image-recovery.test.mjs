import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_BRIEF, fallbackImageResearch, buildSalesImagePrompt
} from '../lib/realizo-images/creative.js';
import {
  shouldExpireImageJob, secondsAllowed
} from '../lib/realizo-images/job-timeout.js';

test('tareas de imágenes usan límites independientes de 3 y 10 minutos',()=>{
  const start=Date.parse('2026-11-03T12:00:00Z');
  const a={status:'submitted',created_at:'2026-11-03 12:00:00',idempotency_key:'image_research_v1_123'};
  const b={...a,idempotency_key:'image_create_v1_456'};
  assert.equal(secondsAllowed(a),180);
  assert.equal(secondsAllowed(b),600);
  assert.equal(shouldExpireImageJob(a,start+179000),false);
  assert.equal(shouldExpireImageJob(a,start+180000),true);
  assert.equal(shouldExpireImageJob(b,start+599000),false);
  assert.equal(shouldExpireImageJob(b,start+600000),true);
  assert.equal(shouldExpireImageJob({...b,status:'completed'},start+999000),false);
  assert.equal(shouldExpireImageJob({...b,idempotency_key:'video_123'},start+999000),false);
});
test('si falla Gemini, existe un prompt comercial seguro con el producto',()=>{
  const brief={...DEFAULT_BRIEF,product_name:'Producto de prueba',creative_type:'oferta',aspect_ratio:'4:5'};
  const fallback=fallbackImageResearch(brief);
  assert.match(fallback.research_note,/sin datos externos/i);
  const prompt=buildSalesImagePrompt(brief,fallback);
  assert.match(prompt,/Producto de prueba/);
  assert.match(prompt,/4:5/);
  assert.match(prompt,/NO inventar testimonios/);
});
test('el endpoint detecta error HTTP 400 con status failed anidado',()=>{
  const s=readFileSync('app/api/wallet/jobs/[id]/route.js','utf8');
  assert.match(s,/result\.detail\?\.status/);
  assert.match(s,/\['failed','cancelled','canceled'\]/);
  assert.match(s,/provider_failed/);
  assert.match(s,/shouldExpireImageJob/);
});
test('generación funciona con fallo de investigación sin segundo cargo Gemini',()=>{
  const source=readFileSync('app/api/realizo/images/generate/route.js','utf8');
  assert.match(source,/fallbackImageResearch/);
  assert.match(source,/\['completed','failed'\]/);
  assert.match(source,/image_create_v1_/);
  assert.match(source,/source\.upload_id!==body\.upload_id/);
});
test('la biblioteca de videos excluye procesos internos de imágenes',()=>{
  const s=readFileSync('app/api/realizo/jobs/route.js','utf8');
  assert.match(s,/model_id NOT IN/);
  const wallet=readFileSync('app/api/wallet/route.js','utf8');
  assert.match(wallet,/reconcilePendingUserImages/);
});
