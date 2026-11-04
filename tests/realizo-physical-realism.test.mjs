import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_REALISM_MARKER,applyRealismToVideoInput} from '../lib/realizo-creative/video-realism.js';
import {buildLuxuryFilmPrompt,buildHighConversionVideoPrompt} from '../lib/realizo-creative/sales-director.js';
import {buildLockedUgc30Prompt} from '../lib/realizo-creative/ugc-master-30.js';

test('all videos use a physical-photography contract, preserving authentic plastic',()=>{
  const original={prompt:'A product packshot on a real wood table.',duration:8};
  const normalized=applyRealismToVideoInput(original);
  assert.match(normalized.prompt,/REALIZO_REALISM_STANDARD v1/);
  assert.match(normalized.prompt,/including plastic when the product is actually plastic/);
  assert.match(normalized.prompt,/No waxy skin/);
  assert.equal(original.prompt,'A product packshot on a real wood table.');
  assert.equal(applyRealismToVideoInput(normalized),normalized);
});

test('Premium product-only film includes realism with no human cast changes',()=>{
  const prompt=buildLuxuryFilmPrompt({
    product:'Nippori',style:'premium',castMode:'product_only',audioMode:'no_voice',
    duration:8,shots:3,videoLanguage:'es',voice:'',imageProvided:true,
    capabilities:{usesReferenceImages:true,imageRole:'product_reference'}
  });
  assert.match(prompt,/REALIZO_REALISM_STANDARD v1/);
  assert.match(prompt,/ZERO HUMAN PIXELS/);
  assert.match(prompt,/REALIZO LUXURY FILM CONTRACT/);
});

test('ordinary commercial and UGC templates retain realistic finishes',()=>{
  const prompt=buildHighConversionVideoPrompt({
    cinema:false,templateId:null,duration:8,shots:2,ugc:false,style:'demo',
    castMode:'with_people',audioMode:'voice',videoLanguage:'es',market:'EC',
    salesBeats:[{start:0,end:2,name:'HOOK'}],capabilities:{
      usesReferenceImages:true,imageRole:'product_reference',videoQualityGuide:'Natural practical optics'
    },imageProvided:true,product:'Nippori',sellerDescription:'A real product.',
    voice:'A short credible demonstration.',voiceBudget:{target:14},
    productGeometry:null,angle:'demo',buyerMotive:'Genuine product value',
    researchedClaims:[],hook:'Watch this',cta:'Learn more',aiShots:[]
  });
  assert.match(prompt,/REALIZO_REALISM_STANDARD v1/);
  const ugc=buildLockedUgc30Prompt({
    duration:30,product:'Nippori',sellerDescription:'Shampoo para el cabello de uso cotidiano.',
    voice:'¿Quieres conocer Nippori? Mira este shampoo en una rutina sencilla. Observa su presentación y cómo se integra en el cuidado diario. Consulta detalles antes de comprarlo.',
    market:'EC',templateActor:'hombre'
  });
  assert.match(ugc,/REALIZO_REALISM_STANDARD v1/);
  assert.ok(ugc.length<=12500);
  assert.match(ugc,/TOP-PRIORITY AUDIO DIRECTOR/);
});
