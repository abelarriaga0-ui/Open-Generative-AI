import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildVideoBrief,suggestSalesAngle,summarizeProductDocument,SALES_ANGLES} from '../lib/realizo-creative/brief.js';
import {sniffImageMime,mediaSignature,canReadSignedMedia,MEDIA_LIFETIME} from '../lib/realizo-creative/media.js';
import {walletPilotAction} from '../lib/wallet/request-policy.js';
import {readFileSync} from 'node:fs';
test('angles chosen using product description without inventing claims',()=>{
  assert.equal(suggestSalesAngle('instrucciones paso a paso para aplicar'), 'demo');
  assert.equal(suggestSalesAngle('descuento precio especial'),'offer');
  assert.equal(suggestSalesAngle('premium artesanal'),'premium');
  assert.ok(SALES_ANGLES.some(a=>a.id==='auto'));
  const r=buildVideoBrief({
    productName:'Cuidado capilar',description:'Sérum de prueba',
    documentText:'Modo de uso: colocar pequeña cantidad.\nBeneficios: hidratación.',
    angle:'auto',references:2,cta:'Conoce más'
  });
  assert.match(r.prompt,/Cuidado capilar/);
  assert.match(r.prompt,/imagen principal/);
  assert.match(r.prompt,/Modo de uso/);
  assert.match(r.prompt,/No inventar características/);
  assert.ok(r.prompt.length<=6000);
  assert.ok(summarizeProductDocument('Beneficios: hidratación\nMaterial: frasco').highlights.length>0);
});
test('images are detected by content, not attacker-controlled MIME alone',()=>{
  assert.equal(sniffImageMime(Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0])),'image/jpeg');
  assert.equal(sniffImageMime(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])),'image/png');
  assert.equal(sniffImageMime(new Uint8Array(12)),null);
});
test('signed private image links cannot be guessed and always expire',async()=>{
  const pepper='a'.repeat(64);
  const id='00000000-0000-4000-8000-000000000001',exp=Math.floor(Date.now()/1000)+1000;
  const a=await mediaSignature(pepper,id,exp),b=await mediaSignature(pepper,id,exp+1);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.notEqual(a,b);
  assert.equal(canReadSignedMedia(exp),true);
  assert.equal(canReadSignedMedia(0),false);
  assert.equal(canReadSignedMedia(exp+MEDIA_LIFETIME+1),false);
});
test('creative uploads are available only for authenticated Realizo native routes',()=>{
  assert.equal(walletPilotAction('/api/realizo/media',true,true),'allow');
  assert.equal(walletPilotAction('/api/realizo/media/abc',true,true),'allow');
  assert.equal(walletPilotAction('/api/realizo/media',true,false),'deny');
  assert.equal(walletPilotAction('/api/realizo/secrets',true,true),'deny');
});
test('original editor accepts prepared image URLs and product brief',()=>{
  const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
  assert.match(editor,/preparedBrief/);assert.match(editor,/applyUserSelectedVariant\(variant, "i2v", family\)/);
  assert.match(editor,/setUploadedImageUrls\(briefImages/);
  assert.match(editor,/uploadAsset\(file\)/);
  const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
  assert.match(wrapper,/RealizoCreator/);
  assert.match(wrapper,/persistenceScope=\{accountId\}/);
  assert.match(wrapper,/previewOnly/);
});
