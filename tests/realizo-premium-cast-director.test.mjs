import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {normalizeCastMode,castDirection} from '../lib/realizo-creative/cast-mode.js';
import {validatePremiumInput} from '../lib/realizo-creative/ai-premium.js';

const concept={
 name:'Perfume elegante',angle:'deseo',creative_style:'premium',
 hook:'El detalle de la noche',spoken_script:'Descubre una fragancia para tu rutina de noche.',
 video_prompt:'Hombre explica a cámara durante 8 segundos y sostiene perfume',
 shots:['Selfie con el perfume','Frasco'],
 cta:'Conoce la fragancia'
};
const base={concept,productName:'Perfume premium',description:'Fragancia para uso cotidiano y salidas',
 modelId:'seedance-2.5-intl-omni-reference',style:'premium',duration:12,shotPreference:'multi'};
test('only-product film never requests human actor, presenter or spoken monologue',()=>{
 const film=buildCommercialDirectorPackage({...base,castMode:'product_only'});
 assert.equal(film.shot_count,5);
 assert.equal(film.cast_mode,'product_only');
 assert.match(film.prompt,/CAST CONTRACT: PRODUCT ONLY/);
 assert.match(film.prompt,/No people/);
 assert.match(film.prompt,/music/i);
 assert.doesNotMatch(film.prompt,/UGC TALKING-HEAD SCHEDULE/);
 assert.doesNotMatch(film.prompt,/APPROVED CREATIVE DIRECTION/);
 assert.doesNotMatch(film.prompt,/RESEARCHED SHOT IDEAS/);
 assert.doesNotMatch(film.prompt,/EXACT sales dialogue/);
 assert.match(film.prompt,/REFERENCE IMAGE/);
});
test('with-people premium film has cinematic acting, not a selfie review',()=>{
 const film=buildCommercialDirectorPackage({...base,castMode:'with_people'});
 assert.equal(film.cast_mode,'with_people');
 assert.match(film.prompt,/CAST CONTRACT: PRODUCT WITH PEOPLE/);
 assert.match(film.prompt,/NEVER speak to the lens/);
 assert.match(film.prompt,/FASHION\/BEAUTY FILM STORYBOARD/);
 assert.doesNotMatch(film.prompt,/UGC TALKING-HEAD SCHEDULE/);
});
test('one-shot means one continuous cinematographic take',()=>{
 const film=buildCommercialDirectorPackage({...base,castMode:'product_only',shotPreference:'single'});
 assert.equal(film.shot_count,1);
 assert.match(film.prompt,/ONE CONTINUOUS CINEMATIC SHOT/);
});
test('UGC keeps its independently selected talking-head contract',()=>{
 const ugc=buildCommercialDirectorPackage({...base,style:'ugc',castMode:'product_only'});
 assert.match(ugc.prompt,/UGC TALKING-HEAD SCHEDULE/);
 assert.match(ugc.prompt,/VOICE-FIRST EDITING/);
});
test('cast choices are validated and persisted by Premium API',()=>{
 assert.equal(normalizeCastMode('untrusted'),'with_people');
 assert.match(castDirection('premium','product_only'),/No people/);
 const route=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(route,/cast_mode/);
 assert.match(approval,/castMode/);
 assert.match(ui,/Solo producto/);
 assert.match(ui,/Con personas/);
});
