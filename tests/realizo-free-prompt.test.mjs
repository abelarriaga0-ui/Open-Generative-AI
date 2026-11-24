import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const creator=readFileSync('components/RealizoFreePrompt.jsx','utf8');
const studio=readFileSync('components/RealizoStudio.jsx','utf8');
const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
const generate=readFileSync('app/api/wallet/generate/route.js','utf8');

test('Prompt libre exists as independent mode, accessible from navigation and home',()=>{
 assert.match(studio,/import RealizoFreePrompt from '@\/components\/RealizoFreePrompt'/);
 assert.match(studio,/creatorMode==='manual' \? <RealizoFreePrompt/);
 assert.match(studio,/onManual=\{\(\)=>chooseCreatorMode\('manual'\)\}/);
 assert.match(studio,/onClick=\{\(\)=>chooseCreatorMode\('manual'\)\}/);
 assert.match(creator,/data-testid="realizo-prompt-libre"/);
 assert.match(creator,/Escribe tu prompt libre/);
 assert.match(creator,/textarea id="realizo-free-prompt-text"/);
 assert.match(studio,/onWalletRefresh=\{refreshWallet\}/);
});
test('model-specific free input preserves user speech and uses correct MuAPI fields',()=>{
 const pure=creator.slice(creator.indexOf('const ENGINES='),creator.indexOf('export default function RealizoFreePrompt'));
 const {ENGINES,engineById,buildFreeInput}=runInNewContext(pure+'\n({ENGINES,engineById,buildFreeInput})');
 assert.equal(ENGINES.length,3);
 assert.equal(engineById('seedance').model,'seedance-2-omni-reference');
 assert.equal(engineById('veo').model,'veo3.1-reference-to-video');
 assert.equal(engineById('kling').model,'kling-4.0-reference-to-video');
 const values={prompt:'Una persona habla a cámara en español latino.',duration:8,ratio:'9:16',resolution:'720p',quality:'high'};
 const photos=[{url:'https://realizo.example/media.png'}];
 const seed=buildFreeInput(engineById('seedance'),values,photos);
 const veo=buildFreeInput(engineById('veo'),values,photos);
 const kling=buildFreeInput(engineById('kling'),values,photos);
 assert.equal(seed.prompt,values.prompt);assert.deepEqual(Array.from(seed.images_list),[photos[0].url]);
 assert.equal(seed.aspect_ratio,'9:16');assert.equal(seed.quality,'high');assert.equal(seed.resolution,undefined);
 assert.equal(veo.generate_audio,true);assert.equal(veo.duration,8);
 assert.equal(veo.aspect_ratio,undefined);assert.equal(veo.quality,undefined);
 assert.deepEqual(Array.from(kling.image_urls),[photos[0].url]);assert.equal(kling.images_list,undefined);
 assert.equal(kling.resolution,'720p');assert.equal(kling.aspect_ratio,'9:16');
 assert.equal(engineById('veo').min,8);assert.equal(engineById('veo').max,8);
});
test('free mode cannot bill before verified quote and explicit confirmation',()=>{
 assert.match(creator,/await fetch\('\/api\/wallet\/quote'/);
 assert.match(creator,/await fetch\('\/api\/wallet\/generate'/);
 assert.match(creator,/max_price_cents:quote\.price_cents/);
 assert.match(creator,/idempotency_key:idempotencyRef\.current/);
 assert.match(creator,/if\(sending\|\|quoting\|\|!validPrompt\|\|!referencesValid\|\|!quote\?\.affordable\|\|quote\.signature!==signature\)return/);
 assert.match(creator,/setValues\(old=>\(\{\.\.\.old,\[key\]:value\}\)\);setQuote\(null\)/);
 assert.match(creator,/setPhotos\(old=>old\.filter\(x=>x\.id!==p\.id\)\);setQuote\(null\)/);
 assert.match(creator,/price_changed_confirm_again/);
 assert.match(quote,/quoteLiveVideo/);
 assert.match(generate,/createReservedJob/);
});
test('reference models need a user-owned image; private video status stays authenticated',()=>{
 assert.match(creator,/photos\.length>0&&photos\.length<=engine\.maxImages/);
 assert.match(creator,/await uploadAsset\(file\)/);
 assert.match(creator,/fetch\('\/api\/wallet\/jobs\/'/);
 assert.match(creator,/Number\.isInteger\(result\.provider_progress_percent\)/);
 assert.match(creator,/data-realizo-owned-video="true"/);
 assert.match(creator,/realizo:prompt-libre:active:/);
 assert.match(quote,/ensureOwnedMedia/);
 assert.match(generate,/ensureOwnedMedia/);
});
