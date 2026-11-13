import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const wizard=readFileSync('components/RealizoSeedanceFlow.jsx','utf8');
const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
const generate=readFileSync('app/api/wallet/generate/route.js','utf8');

test('user chooses Seedance, Veo 3.1 or Kling 4.0 before duration and product questions',()=>{
  assert.match(wrapper,/<RealizoSeedanceFlow/);
  assert.match(wizard,/const VIDEO_ENGINES=\[/);
  assert.match(wizard,/modelId:'seedance-2-omni-reference'|const MODEL_ID='seedance-2-omni-reference'/);
  assert.match(wizard,/modelId:'veo3\.1-reference-to-video'/);
  assert.match(wizard,/modelId:'kling-4\.0-reference-to-video'/);
  assert.match(wizard,/¿Con qué IA creamos tu video\?/);
  assert.match(wizard,/onClick=\{\(\)=>chooseEngine\(engine\.id\)\}/);
  assert.match(wizard,/model_id:modelId,input/);
  assert.match(wizard,/image_urls:images/);
  assert.match(wizard,/generate_audio:true/);
});
test('user sees sequential questions, explicit quote and deliberate charge',()=>{
  assert.match(wizard,/QUESTIONS=\[/);
  assert.match(wizard,/setStep\(old=>Math\.min\(6,old\+1\)\)/);
  assert.match(wizard,/setStep\(3\)/);
  assert.match(wizard,/setStep\(4\)/);
  assert.match(wizard,/\/api\/wallet\/quote/);
  assert.match(wizard,/\/api\/wallet\/generate/);
  assert.match(wizard,/max_price_cents:quote\.price_cents/);
  assert.match(wizard,/model_id:modelId/);
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
  assert.match(wizard,/photos\.length>=activeEngine\.maxImages/);
  assert.match(wizard,/images_list/);
  assert.match(wizard,/image_urls/);
  assert.match(wizard,/if\(step===0 && \(!photos\.length/);
  assert.match(wizard,/durationsForEngine\(activeEngine\)\.map/);
  assert.match(wizard,/@image1/);
  assert.match(wizard,/NO es un fotograma inicial/);
});

test('duration can be selected immediately and supports all Seedance 2.0 4–15 second values',()=>{
 const entry=wizard.indexOf('data-testid="realizo-duration-shortcut"');
 const firstStep=wizard.indexOf('{step===0&&');
 assert.ok(entry>=0 && entry<firstStep,'Duration control must be above the first step');
 assert.match(wizard,/const DURATION_OPTIONS=durationsForEngine\(VIDEO_ENGINES\[0\]\)/);
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
 const source=wizard.slice(wizard.indexOf('const MODEL_ID='),wizard.indexOf('const QUESTIONS=['))+wizard.slice(wizard.indexOf('function compactSpeech('),wizard.indexOf('function Option({'));
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

test('each engine uses only supported reference fields, durations and native audio flags',()=>{
 const source=wizard.slice(wizard.indexOf('const MODEL_ID='),wizard.indexOf('const QUESTIONS=['))+
   wizard.slice(wizard.indexOf('function compactSpeech('),wizard.indexOf('function Option({'));
 const {engineById,durationsForEngine,inputForEngine,buildScenePlan,scriptFor}=runInNewContext(source+
   '\n({engineById,durationsForEngine,inputForEngine,buildScenePlan,scriptFor})',{
   OBJECTIVES:[{id:'sales',name:'Generar ventas'}]
 });
 const photo={url:'https://realizo.example/p.png'};
 const product={name:'GODA',description:'Perfume masculino',style:'ugc',duration:8,
   resolution:'720p',ratio:'9:16',quality:'high',market:'Ecuador',audience:'Hombres adultos',objective:'sales',
   cta:'Escríbenos por WhatsApp',problem:'',benefit:'',notes:'',sceneLines:{},imageCount:1};
 const seed=engineById('seedance'),veo=engineById('veo'),kling=engineById('kling');
 assert.equal(durationsForEngine(seed).length,12);
 assert.equal(durationsForEngine(veo).join(','),'8');
 assert.equal(durationsForEngine(kling).length,28);
 const s=inputForEngine(seed,product,scriptFor({...product,engine:'seedance'}),[photo]);
 assert.ok(Array.isArray(s.images_list)&&s.quality==='high'&&!('resolution' in s));
 assert.ok(s.prompt.includes('@image1')&&!s.prompt.includes('@image_1'));
 const v=inputForEngine(veo,{...product,duration:8},scriptFor({...product,engine:'veo'}),[photo]);
 assert.ok(v.generate_audio===true&&v.duration===8&&Array.isArray(v.images_list));
 assert.ok(!('aspect_ratio' in v)&&!('quality' in v));
 assert.ok(v.prompt.includes('VEO 3.1')&&!v.prompt.includes('@image1'));
 const k=inputForEngine(kling,{...product,duration:30},scriptFor({...product,engine:'kling',duration:30}),[photo]);
 assert.ok(Array.isArray(k.image_urls)&&!('images_list' in k)&&!('quality' in k));
 assert.ok(k.prompt.includes('@image_1')&&k.prompt.includes('KLING 4.0'));
 for(let duration=3;duration<=30;duration++){
   const scenes=buildScenePlan({...product,duration,engine:'kling'});
   assert.equal(scenes[0].from,0);
   assert.equal(scenes.at(-1).to,duration);
   assert.ok(scenes.every(x=>x.seconds>0&&x.seconds<=4),'max 4s at '+duration);
   assert.ok(scenes.every(x=>x.line.split(/\s+/).length<=x.maxWords),'speech fits '+duration);
 }
});
