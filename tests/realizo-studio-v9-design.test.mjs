import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=readFileSync('components/RealizoStudio.jsx','utf8');
const templates=readFileSync('components/RealizoTemplateLibrary.jsx','utf8');
const premium=readFileSync('components/RealizoPremium.jsx','utf8');
const creator=readFileSync('components/RealizoCreator.jsx','utf8');
const layout=readFileSync('app/layout.js','utf8');
const css=readFileSync('app/realizo-redesign-v9.css','utf8');
const wallet=readFileSync('app/wallet/page.jsx','utf8');

test('REALIZO native Studio has working sections and an accessible template-style view',()=>{
 assert.match(root,/nav\('home','Inicio'/);
 assert.match(root,/nav\('create','Crear video'/);
 assert.match(root,/nav\('templates','Estilos e ideas'/);
 assert.match(root,/nav\('videos','Mis videos'/);
 assert.match(root,/page==='templates'/);
 assert.match(root,/<RealizoTemplateLibrary onChoose={chooseVisualFormat}\/>/);
 assert.match(root,/setFormatPreset\(format\);setCreatorMode\('premium'\);setPage\('create'\)/);
 assert.match(root,/aria-current={page===id\?'page':undefined}/);
 assert.match(root,/page==='create'/);
 assert.match(root,/page==='videos'/);
 assert.match(root,/href="\/wallet"/);
});
test('visual styles illustrate ideas, never claim to be pre-generated fixed motion templates',()=>{
 assert.equal((templates.match(/id:'(?:ugc|cine|premium|demo|cinematic)-/g)||[]).length,8);
 assert.match(templates,/\['Todos','UGC','Cine','Premium','Demo'\]/);
 assert.match(templates,/onClick={\(\)=>onChoose\(look.style\)}/);
 assert.match(templates,/Vistas ilustrativas del estilo/);
 assert.match(templates,/aria-pressed={filter===f}/);
 assert.doesNotMatch(templates,/fetch\(|\/api\/wallet|generateWithRealizoWallet/);
});
test('redesign is scoped and loaded after prior theme, preserving original generation contracts',()=>{
 assert.ok(layout.indexOf("import './realizo-visual.css'")<layout.indexOf("import './realizo-redesign-v9.css'"));
 assert.match(css,/\.realizo-app,\.realizo-wallet-page/);
 assert.match(css,/\.realizo-template-grid/);
 assert.match(css,/\.realizo-premium-progress/);
 assert.match(css,/\.realizo-hero-composition/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(root,/onWalletGenerate={onWalletGenerate}/);
 assert.match(root,/generationReady={generationReady}/);
 assert.match(root,/preparedBrief={brief}/);
 assert.match(root,/persistenceScope={accountId}/);
 assert.match(root,/onWalletRefresh={refreshWallet}/);
 assert.match(root,/onUseAutomatic={\(\)=>chooseCreatorMode\('automatic'\)}/);
 assert.match(wallet,/<PaypalTopup/);
});
test('premium research and manual creation retain edits and controls',()=>{
 assert.match(premium,/realizo-premium-progress/);
 assert.match(premium,/seller_claims_confirmed:sellerConfirmed/);
 assert.match(premium,/reviewDuration/);
 assert.match(premium,/onClick={start}/);
 assert.match(premium,/onClick={approve}/);
 assert.match(premium,/onUseAutomatic/);
 assert.match(creator,/realizo-tech-details/);
 assert.match(creator,/onChange={e=>setPrepared\(p=>\(\{\.\.\.p,prompt:e.target.value\}\)\)}/);
 assert.match(creator,/onPrepare\(next\);onOpenAdvanced\(\)/);
});

test('Crear video defaults to premium AI everywhere, while free and manual modes stay selectable',()=>{
 assert.match(root,/\[creatorMode,setCreatorMode\]=useState\('premium'\)/);
 const start=root.match(/function startNewVideo\(\)\{([\s\S]*?)\n \}/)?.[1];
 assert.ok(start,'must find startNewVideo');
 assert.match(start,/setCreatorMode\('premium'\)/);
 assert.doesNotMatch(start,/setCreatorMode\('automatic'\)/);
 const section=root.slice(root.indexOf('aria-label="Modalidad de creación"'),root.indexOf("{creatorMode==='premium'?"));
 assert.ok(section.indexOf("['premium','✦ Crear con IA · Recomendado']")<section.indexOf("['automatic','Sin investigación IA']"));
 assert.ok(section.indexOf("['automatic','Sin investigación IA']")<section.indexOf("['manual','Manual · tu prompt']"));
 assert.match(section,/data-primary-mode=\{id==='premium'\?'true':undefined\}/);
 assert.match(root,/onUseAutomatic=\{\(\)=>chooseCreatorMode\('automatic'\)\}/);
 assert.match(root,/if\(mode==='manual'\)openEditor\(\)/);
 assert.match(css,/\.realizo-modes button\[data-primary-mode="true"\]/);
});
