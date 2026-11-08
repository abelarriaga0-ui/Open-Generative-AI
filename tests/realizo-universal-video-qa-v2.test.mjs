import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  VIDEO_REALISM_MARKER,VIDEO_CONTINUITY_MARKER,VIDEO_VOICE_MARKER,VIDEO_FILM_FX_MARKER,
  applyRealismToVideoInput
} from '../lib/realizo-creative/video-realism.js';
import {filmAudioDirection} from '../lib/realizo-creative/audio-mode.js';

const ugc={project_id:'12345678-0000-0000-0000-123456789abc',creative_style:'ugc',cast_mode:'with_people',audio_mode:'no_voice'};
const film={...ugc,creative_style:'premium',cast_mode:'product_only'};
test('all Realizo videos receive a per-frame physical and product-identity continuity rule',()=>{
 const input={prompt:'An adult opens the correct physical product and talks to camera.',duration:30,image_url:'https://example.com/photo.png'};
 const output=applyRealismToVideoInput(input);
 assert.match(output.prompt,/REALIZO_REALISM_STANDARD v1/);
 assert.match(output.prompt,/REALIZO_VISUAL_CONTINUITY_V2/);
 assert.match(output.prompt,/cap\/dropper\/dispenser/i);
 assert.match(output.prompt,/plausible supports, grip, contact shadows/);
 assert.match(output.prompt,/Each visible action must match the words spoken/);
 assert.equal(output.duration,30);
 assert.equal(output.image_url,input.image_url);
 assert.equal(input.prompt,'An adult opens the correct physical product and talks to camera.');
 assert.equal(applyRealismToVideoInput(output),output,'exact idempotency, no prompt bloat');
});

test('voice requirement applies to voiced UGC even if the film audio selector is no_voice',()=>{
 const result=applyRealismToVideoInput({prompt:'UGC presenter.',duration:30},{creativeContext:ugc});
 assert.match(result.prompt,/REALIZO_VOICE_CONTINUITY_V2/);
 assert.match(result.prompt,/intelligible narration\/dialogue/);
 assert.match(result.prompt,/avoid audio cuts at scene boundaries/);
 assert.match(result.prompt,/finish the approved spoken CTA/);
 assert.doesNotMatch(result.prompt,/REALIZO_INTENTIONAL_FILM_FX_V2/);
 assert.equal(applyRealismToVideoInput(result,{creativeContext:ugc}),result);
});
test('silent Premium product-only stays silent and permits intentional requested film effects',()=>{
 const result=applyRealismToVideoInput({prompt:'REALIZO LUXURY FILM CONTRACT v2 AUDIO NO_VOICE. ABSOLUTE NO-VOICE AUDIO LOCK. Film product with smoke.',duration:30},
   {creativeContext:film});
 assert.match(result.prompt,/REALIZO_INTENTIONAL_FILM_FX_V2/);
 assert.match(result.prompt,/only when expressly requested/);
 assert.match(result.prompt,/never add people or hands/);
 assert.doesNotMatch(result.prompt,/REALIZO_VOICE_CONTINUITY_V2/);
});
test('silent films and people-led films never have unrequested levitation or mandatory narration',()=>{
 const silent=applyRealismToVideoInput({prompt:'No voice, music only.',duration:8});
 assert.doesNotMatch(silent.prompt,/REALIZO_VOICE_CONTINUITY_V2/);
 const people=applyRealismToVideoInput({prompt:'Actor discusses product.',duration:30},
   {creativeContext:{...film,cast_mode:'with_people',audio_mode:'voiceover'}});
 assert.match(people.prompt,/REALIZO_VOICE_CONTINUITY_V2/);
 assert.doesNotMatch(people.prompt,/REALIZO_INTENTIONAL_FILM_FX_V2/);
});
test('regular video editor spoken narration gets the voice continuity standard without changing model',()=>{
 const x=applyRealismToVideoInput({prompt:'Spanish voiceover. The actor speaks to the viewer.',duration:20});
 assert.match(x.prompt,/REALIZO_VOICE_CONTINUITY_V2/);
 assert.equal(x.duration,20);
});
test('previously approved prompts with legacy v1 are upgraded after approval, not rewritten',()=>{
 const legacy={prompt:VIDEO_REALISM_MARKER+' Old approved voiceover text. MANDATORY NARRATION MODE.',duration:30};
 const updated=applyRealismToVideoInput(legacy,{creativeContext:{...film,audio_mode:'voiceover'}});
 assert.match(updated.prompt,new RegExp(VIDEO_CONTINUITY_MARKER));
 assert.match(updated.prompt,new RegExp(VIDEO_VOICE_MARKER));
 assert.match(updated.prompt,new RegExp(VIDEO_FILM_FX_MARKER));
 assert.ok(updated.prompt.endsWith(legacy.prompt),'preserves the exact pre-approved prompt');
});
test('quote and paid generation apply identical policy to identical customer configuration',()=>{
 const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
 const generate=readFileSync('app/api/wallet/generate/route.js','utf8');
 const call='applyRealismToVideoInput(body.input,{creativeContext:body.creative_context})';
 assert.ok(quote.includes(call));
 assert.ok(generate.includes(call));
 assert.match(generate,/verifyPremiumGeneration\(/);
 assert.match(generate,/createReservedJob\(/);
 assert.match(generate,/POST['"]?,/);
});
test('film audio policy explicitly protects dialogue and speech, never speaks silent film',()=>{
 const spoken=filmAudioDirection('voiceover','product_only','es','¿Quieres conocerlo? Pídelo hoy.',30);
 assert.match(spoken,/SPEECH CONTINUITY \/ MIX/);
 assert.match(spoken,/duck music\/foley/);
 assert.match(spoken,/¿Quieres conocerlo\? Pídelo hoy\./);
 const dialogue=filmAudioDirection('dialogue','with_people','es','Hola. Claro.',20);
 assert.match(dialogue,/SPEECH CONTINUITY \/ MIX/);
 const mute=filmAudioDirection('no_voice','product_only','es','',30);
 assert.match(mute,/ABSOLUTE NO-VOICE AUDIO LOCK/);
 assert.doesNotMatch(mute,/SPEECH CONTINUITY \/ MIX/);
});
