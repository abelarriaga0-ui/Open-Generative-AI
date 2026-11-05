import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAudioMode,filmAudioValid,filmAudioDirection} from '../lib/realizo-creative/audio-mode.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {verifyPremiumGeneration} from '../lib/realizo-creative/premium-generation-gate.js';

const uuid='f04c5736-4a28-4895-8bd6-9b7cd8773e42';
const model='gemini-omni-image-to-video';
const concept={name:'Cabello hermoso',creative_style:'ugc',angle:'problem',
 spoken_script:'Conoce este shampoo para tu rutina capilar.',
 video_prompt:'Mujer habla a la cámara en el baño',shots:['Mujer en baño']};
function create(mode='no_voice',cast='product_only'){
 return buildCommercialDirectorPackage({concept,productName:'Nipori',
 description:'Champú capilar en envase azul',
 modelId:model,workflowId:'references',
 style:'premium',castMode:cast,audioMode:mode,duration:8,shotPreference:'multi'});
}
function db(row){return {prepare:()=>({bind:()=>({first:async()=>row})})};}
test('Sin voces keeps original music and foley but absolutely excludes speech',()=>{
 const film=create();
 assert.equal(film.audio_mode,'no_voice');
 assert.equal(film.spoken_script,'');
 assert.match(film.prompt,/AUDIO NO_VOICE/);
 assert.match(film.prompt,/ABSOLUTE NO-VOICE AUDIO LOCK/);
 assert.match(film.prompt,/original instrumental cinematic music/);
 assert.doesNotMatch(film.prompt,/Conoce este shampoo|Mujer habla a la cámara/);
});
test('Voz en off permits product-only images and requires audible narrator',()=>{
 const f=create('voiceover');
 assert.match(f.prompt,/AUDIO VOICEOVER/);
 assert.match(f.prompt,/MANDATORY NARRATION MODE/);
 assert.match(f.prompt,/OFF-SCREEN/);
 assert.match(f.prompt,/Approved narration: "Conoce este shampoo/);
 assert.match(f.prompt,/ABSOLUTE PRODUCT-ONLY CAST LOCK/);
 assert.doesNotMatch(f.prompt,/ABSOLUTE NO-VOICE AUDIO LOCK/);
 assert.equal(f.audio_mode,'voiceover');
});
test('Dialogue requires people, a defined script, and non-UGC cinematic acting',()=>{
 assert.equal(filmAudioValid('dialogue','product_only'),false);
 assert.equal(filmAudioValid('dialogue','with_people'),true);
 assert.throws(()=>create('dialogue','product_only'),/premium_audio_cast_conflict/);
 const f=create('dialogue','with_people');
 assert.match(f.prompt,/MANDATORY ON-SCENE DIALOGUE MODE/);
 assert.match(f.prompt,/speak a brief believable exchange/);
 assert.doesNotMatch(f.prompt,/ABSOLUTE NO-VOICE AUDIO LOCK/);
 assert.throws(()=>filmAudioDirection('voiceover','product_only','es',''),/premium_audio_script_required/);
 assert.equal(normalizeAudioMode(null),'no_voice');
});
test('wallet gate requires audio match with approved project before pricing',async()=>{
 const p=create('voiceover');
 const row={id:uuid,status:'approved',creative_style:'premium',cast_mode:'product_only',
  audio_mode:'voiceover',approved_prompt:p.prompt,video_model_id:model,video_duration_seconds:8};
 const ctx={project_id:uuid,creative_style:'premium',cast_mode:'product_only',audio_mode:'voiceover'};
 const input={prompt:p.prompt,duration:8};
 assert.equal(await verifyPremiumGeneration(db(row),uuid,model,input,ctx),null);
 assert.equal(await verifyPremiumGeneration(db(row),uuid,model,input,{...ctx,audio_mode:'no_voice'}),'premium_brief_reapproval_required');
 assert.equal(await verifyPremiumGeneration(db(row),uuid,model,{...input,prompt:create('no_voice').prompt},ctx),'premium_brief_reapproval_required');
 assert.equal(await verifyPremiumGeneration(db({...row,approved_prompt:row.approved_prompt.replace('MANDATORY NARRATION MODE','OPTIONAL NARRATOR')}),uuid,model,{...input,prompt:input.prompt.replace('MANDATORY NARRATION MODE','OPTIONAL NARRATOR')},ctx),'premium_audio_contract_missing');
});
test('audio choice persists from creation and approval through all studio generation paths',()=>{
 const createApi=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const approve=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 const studio=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 const gate=readFileSync('lib/realizo-creative/premium-generation-gate.js','utf8');
 const ci=readFileSync('.github/workflows/wallet-schema.yml','utf8');
 assert.match(createApi,/template_change_request,cast_mode,audio_mode/);
 assert.match(approve,/audio_mode=\?,updated_at/);
 assert.match(approve,/audio_mode:audioMode/);
 assert.match(ui,/Sin voces/);
 assert.match(ui,/Voz en off/);
 assert.match(ui,/Con diálogo/);
 assert.match(approve,/normalizeAudioMode\(project\.audio_mode\)/);
 assert.match(ui,/body:JSON.stringify\(\{index:selection/);
 assert.match(studio,/audioMode:preparedBrief.audio_mode/);
 assert.equal((studio.match(/audio_mode:preparedBrief.audio_mode/g)||[]).length,3);
 assert.match(gate,/context.audio_mode!==project.audio_mode/);
 assert.match(ci,/realizo-premium-audio-sandbox.sql/);
});
