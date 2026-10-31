import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premiumVideoOptions,resolvePremiumVideoChoice} from '../lib/realizo-creative/video-specs.js';

test('available endpoints include provider and friendly model/version grouping without losing variants',()=>{
 const models=premiumVideoOptions();
 assert.ok(models.length>0);
 assert.ok(models.every(m=>m.provider&&m.provider_name&&m.family_id&&m.variant_label));
 const choices=new Set(models.map(m=>m.id));
 assert.equal(choices.size,models.length);
 for(const m of models){
  assert.deepEqual(resolvePremiumVideoChoice(m.id,m.durations[0]).modelId,m.id);
  assert.ok(Array.isArray(m.durations)&&m.durations.length>0);
 }
});
test('Seedance 2.5 remains the recommended initial family when available',()=>{
 const models=premiumVideoOptions();
 assert.ok(models.some(m=>m.family_id==='seedance-2.5'));
 assert.ok(models.filter(m=>m.family_id==='seedance-2.5').some(m=>m.durations.length>0));
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/const preferredVideoModel=options=>/);
 assert.match(ui,/m\.family_id==='seedance-2\.5'/);
 assert.match(ui,/video_model_id:recommended\.id/);
});
test('Premium UI shows provider then family then mode, technical variants only on demand',()=>{
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/Proveedor/);
 assert.match(ui,/Modelo y versión/);
 assert.match(ui,/¿Cómo quieres crear el video/);
 assert.match(ui,/Opciones avanzadas del motor/);
 assert.match(ui,/providerOptions\.map/);
 assert.match(ui,/familyOptions\.map/);
 assert.match(ui,/variantsForMode\.map/);
 assert.doesNotMatch(ui,/videoOptions\.map\(model=><option/);
 assert.match(ui,/keyRef\.current=null/);
 const request=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 assert.match(request,/video_options:premiumVideoOptions\(\)/);
 assert.match(request,/data\.modelId,data\.duration,data\.workflowId/);
});
