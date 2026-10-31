import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProductCopy,videoEngineCapabilities,planSalesVideo,
 buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';

const concept={name:'Nippori UGC',angle:'ugc',hook:'¿La caspa te incomoda?',
 spoken_script:'¿Caspa otra vez? Mira Nippori. Descubre el producto y pide hoy. Paga al recibir.',
 cta:'Paga al recibir',shots:['Hook selfie','Uso real','CTA'],
 video_prompt:'Adult speaks to camera with product in bathroom'};
test('seller typos are normalized without inventing claims or asking a rewrite',()=>{
 assert.match(normalizeProductCopy('Shamppo para dermatitis ceboreica'),/Shampoo para dermatitis seborreica/i);
});
test('Seedance 2.5 references are distinct from first-frame animation',()=>{
 assert.equal(videoEngineCapabilities('seedance-2.5-omni-reference').imageRole,'product_reference');
 assert.equal(videoEngineCapabilities('seedance-2.5-image-to-video').imageRole,'start_frame');
 assert.equal(videoEngineCapabilities('seedance-2.5-text-to-video').imageRole,'none');
 const plan=buildCommercialDirectorPackage({concept,productName:'Nippori',
 description:'Shamppo para dermatitis ceboreica',cta:'Paga al recibir',
 modelId:'seedance-2.5-omni-reference',duration:7,style:'ugc',shotPreference:'multi'});
 assert.match(plan.prompt,/NOT the first frame/);
 assert.match(plan.prompt,/SPOKEN SCRIPT/);
 assert.match(plan.prompt,/CTA/);
 assert.match(plan.prompt,/SHOT 1/);
 assert.equal(plan.shot_count,3);
 assert.equal(plan.media_role,'reference_only');
 assert.equal(plan.warning,null);
 const i2v=buildCommercialDirectorPackage({concept,modelId:'seedance-2.5-image-to-video'});
 assert.match(i2v.warning,/primer fotograma/);
});
test('cinematic mode and multi-shot selection are constrained by time not invented pricing',()=>{
 const short=planSalesVideo({concept,style:'cinematic',shotPreference:'multi',duration:5});
 const long=planSalesVideo({concept,style:'cinematic',shotPreference:'multi',duration:15});
 assert.equal(short.shots,2);
 assert.equal(long.shots,5);
 assert.equal(long.cinema,true);
 assert.ok(short.voice.split(/\s+/).length<=Math.floor(5*2.4));
 const c=buildCommercialDirectorPackage({concept,style:'cinematic',shotPreference:'multi',
 modelId:'seedance-2.5-omni-reference',duration:15});
 assert.match(c.prompt,/CINEMATOGRAPHIC/);
 assert.match(c.prompt,/5 coordinated shots/);
 assert.doesNotMatch(c.prompt,/\b(?:free generation|automatically retry)\b/i);
});
test('Premium approved brief actually selects provider reference workflow and charges only after quote',()=>{
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(editor,/preparedBrief\.media_role\s*===\s*'reference_only'/);
 assert.match(editor,/getVideoWorkflowFamily\(item\.id\)\?\.workflowById\.get\("references"\)/);
 assert.match(editor,/referenceImages:images/);
 assert.match(editor,/allowAnimationInsteadOfReference/);
 assert.match(editor,/dynamicDirection/);
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(approval,/media_role:'reference_only'/);
 assert.match(approval,/buildCommercialDirectorPackage/);
 assert.match(approval,/acknowledged_responsibility/);
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/Varias tomas/);
 assert.match(ui,/Cinematográfico/);
 assert.doesNotMatch(ui,/setCorrection/);
 const bridge=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(bridge,/\/api\/wallet\/quote/);
 assert.match(bridge,/window\.confirm/);
});
