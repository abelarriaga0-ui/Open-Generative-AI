import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTemplateVideoInput,TEMPLATE_MODEL_ID,TEMPLATE_PREVIEW_SRC} from '../lib/realizo-creative/template-video-input.js';
const read=p=>readFileSync(p,'utf8');
const image='https://realizo-auth-sandbox.abelarriaga0.workers.dev/api/realizo/media/0a282817-8504-49ec-86fc-956d055e3342?expires=1793510038&sig=abc';
const args={productName:'Irrigador bucal',description:'Irrigador de agua para complementar la higiene oral',
 spokenScript:'¿Quieres completar tu rutina de limpieza? Conoce este irrigador bucal, un aparato práctico que se utiliza con agua para ayudarte en tu cuidado diario. Te muestro cómo usarlo como parte de tu higiene y qué ofrece. Si quieres conocerlo mejor o saber cómo conseguir el tuyo en Ecuador, escríbenos y te contamos todos los detalles.',
 imageUrl:image,actor:'hombre'};
test('template reuses the exact Muapi model and previous successful media-input contract',()=>{
 const packet=makeTemplateVideoInput(args);
 assert.equal(packet.model_id,'seedance-2.5-intl-omni-reference');
 assert.equal(TEMPLATE_MODEL_ID,'seedance-2.5-intl-omni-reference');
 assert.deepEqual(packet.input.images_list,[image]);
 assert.equal(packet.input.videos_list,null);
 assert.equal(packet.input.audios_list,null);
 assert.equal(packet.input.omni_reference_task_type,'reference');
 assert.equal(packet.input.aspect_ratio,'9:16');
 assert.equal(packet.input.duration,30);
 assert.equal(packet.input.resolution,'720p');
 assert.equal(packet.input.draft,false);
 assert.equal(packet.input.seed,null);
 assert.equal(packet.input.high_bitrate,false);
 assert.match(packet.input.prompt,/0-3s HOOK HABLADO/);
 assert.match(packet.input.prompt,/24\.3-30s CTA HABLADO/);
 assert.ok(packet.input.prompt.length<=5400);
});
test('only customer product values and explicitly requested character are changed',()=>{
 const source=makeTemplateVideoInput(args).input.prompt;
 const changed=makeTemplateVideoInput({...args,changeRequest:'Cambiar al personaje por una mujer',actor:'mujer'}).input.prompt;
 assert.match(source,/DEFAULT CREATOR: adult man/);
 assert.match(changed,/DEFAULT CREATOR: adult woman/);
 assert.equal(source.split('SECOND-BY-SECOND SELLING PLAN')[1].split('PRODUCT:')[0],
              changed.split('SECOND-BY-SECOND SELLING PLAN')[1].split('PRODUCT:')[0]);
 assert.doesNotMatch(changed,/Combo noil \+ goda/i);
});
test('template preview uses actual video file, never a decorative-only background',()=>{
 const library=read('components/RealizoTemplateLibrary.jsx');
 assert.equal(TEMPLATE_PREVIEW_SRC,'/assets/realizo/templates/ugc-preview-native-30s.mp4');
 assert.match(library,/onMouseEnter=\{enter\}/);
 assert.match(library,/<video ref=\{preview\}/);
 assert.match(library,/role="dialog"/);
 assert.match(library,/autoPlay playsInline/);
});
test('template does not enter the free creative editor or its model/duration controls',()=>{
 const studio=read('components/RealizoStudio.jsx');
 const template=read('components/RealizoTemplateCreator.jsx');
 assert.match(studio,/setCreatorMode\('premium'\);setPage\('templates'\)/);
 assert.match(studio,/RealizoTemplateCreator/);
 assert.match(template,/api\/realizo\/template\/prepare/);
 assert.match(template,/api\/wallet\/quote/);
 assert.match(template,/api\/wallet\/generate/);
 assert.match(template,/Confirmar y generar/);
 assert.doesNotMatch(template,/Editor avanzado|video_duration_seconds|setVideoModel/);
});
test('template adaptation requires logged-in user and owned image',()=>{
 const route=read('app/api/realizo/template/prepare/route.js');
 assert.match(route,/requireWalletUser/);
 assert.match(route,/enforceSameOrigin/);
 assert.match(route,/isOwnedSignedProductImage/);
 assert.match(route,/realizo_template_product_adaptation_v1/);
 assert.match(route,/max_output_tokens:3000/);
});
