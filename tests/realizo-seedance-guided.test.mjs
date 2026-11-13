import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

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

test('duration can be selected immediately and supports all Seedance 2.0 4–15 second values',()=>{
 const entry=wizard.indexOf('data-testid="realizo-duration-shortcut"');
 const firstStep=wizard.indexOf('{step===0&&');
 assert.ok(entry>=0 && entry<firstStep,'Duration control must be above the first step');
 assert.match(wizard,/const DURATION_OPTIONS=Array\.from\(\{length:12\},\(_,i\)=>i\+4\)/);
 assert.match(wizard,/value=\{d\.duration\} onChange=\{e=>change\('duration',Number\(e\.target\.value\)\)\}/);
 assert.match(wizard,/aria-pressed=\{d\.duration===n\}/);
 assert.match(wizard,/duration:Number\(d\.duration\)/);
 assert.match(wizard,/const change=\(field,value\)=>\{setD\(old=>\(\{\.\.\.old,\[field\]:value\}\)\);setQuote\(null\)/);
});

test('Mis videos reconciles pending Seedance jobs after reopening on a different device',()=>{
 assert.match(wrapper,/const pending=jobs\.filter/);
 assert.match(wrapper,/\/api\/wallet\/jobs\//);
 assert.match(wrapper,/setCreationsRefresh\(count=>count\+1\)/);
 const jobs=readFileSync('app/api/realizo/jobs/route.js','utf8');
 assert.match(jobs,/WHERE user_id=\?/);
});

test('sales director produces spoken visual plan with every cut <= 4 seconds and no overlong default lines',()=>{
 const source=wizard.slice(wizard.indexOf('function compactSpeech('),wizard.indexOf('function Option({'));
 assert.ok(source.startsWith('function compactSpeech') && source.includes('function scriptFor('));
 const {buildScenePlan,scriptFor}=runInNewContext(source+'\n({buildScenePlan,scriptFor})',{
   OBJECTIVES:[{id:'sales',name:'Generar ventas'}]
 });
 const base={name:'GODA',description:'Perfume para hombre',problem:'',benefit:'',style:'ugc',
  cta:'Escríbenos por WhatsApp',audience:'Hombres adultos',market:'Ecuador',
  ratio:'9:16',resolution:'720p',quality:'high',imageCount:1,notes:'',sceneLines:{},
  objective:'sales'};
 for(let duration=4;duration<=15;duration++){
   const input={...base,duration};
   const scenes=buildScenePlan(input);
   assert.equal(scenes[0].from,0);
   assert.equal(scenes.at(-1).to,duration);
   assert.ok(scenes.every(x=>x.seconds>0&&x.seconds<=4), 'max 4s cut at '+duration+'s');
   assert.ok(scenes.every(x=>x.line.split(/\s+/).length<=x.maxWords),'dialogue must fit at '+duration+'s');
   const prompt=scriptFor(input);
   assert.ok(prompt.includes('GUION TEMPORIZADO / STORYBOARD'));
   assert.ok(prompt.includes('AUDIO: pronunciar TEXTUALMENTE'));
   assert.ok(prompt.includes('CORTES REALES'));
   assert.ok(prompt.includes('NO es un fotograma inicial'));
   assert.ok(prompt.includes('CTA'));
   assert.ok(prompt.length<=3900);
   assert.ok(prompt.includes('ESCENA '+scenes.length));
 }
 const full=buildScenePlan({...base,duration:15});
 assert.deepEqual(Array.from(full,x=>x.role),['HOOK','PROBLEMA / DESEO','PRODUCTO / SOLUCIÓN','DEMOSTRACIÓN / BENEFICIO','CIERRE / CTA']);
 assert.ok(scriptFor({...base,duration:15,style:'cine'}).includes('VOZ EN OFF clara y audible'));
 assert.ok(scriptFor({...base,duration:15,style:'ugc'}).includes('MIRA Y HABLA A CÁMARA'));
 const amended=buildScenePlan({...base,duration:15,sceneLines:{hook:'¡Mira mi producto hoy!'}});
 assert.equal(amended[0].line,'¡Mira mi producto hoy!');
 assert.ok(wizard.includes('dialogueTooLong||!quote'));
 assert.ok(wizard.includes('aria-label={\'Diálogo hablado, escena \''));
});
