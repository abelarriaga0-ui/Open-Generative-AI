import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync('app/realizo-motion-home.css','utf8');
const home=readFileSync('components/RealizoMotionHome.jsx','utf8');
const studio=readFileSync('components/RealizoStudio.jsx','utf8');

test('premium hero is compact at desktop 100-percent zoom',()=>{
 assert.match(css,/max-width:1460px;gap:20px/);
 assert.match(css,/realizo-motion-hero\{height:426px;min-height:0/);
 assert.match(css,/font-size:clamp\(39px,3\.15vw,56px\)/);
 assert.match(css,/realizo-motion-film\{top:50%;bottom:auto;left:50%;translate:-50% -50%;width:auto;height:355px/);
 assert.match(css,/realizo-app \.realizo-topbar\{height:70px!important\}/);
 assert.doesNotMatch(css,/\.realizo-app\s*\{\s*zoom\s*:/);
});
test('tablet and mobile have independent proportions, not desktop overflow',()=>{
 assert.match(css,/@media\(min-width:751px\) and \(max-width:1100px\)/);
 assert.match(css,/@media\(max-width:750px\)/);
 assert.match(css,/realizo-motion-stage\{min-height:260px;height:260px\}/);
 assert.match(css,/@media\(max-width:420px\)/);
 assert.match(css,/realizo-motion-stage\{min-height:220px;height:220px\}/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('native 720p video reference and paid generation flow unchanged',()=>{
 assert.match(home,/TEMPLATE_HOVER_SRC/);
 assert.match(home,/controlsList="nodownload noremoteplayback noplaybackrate"/);
 assert.match(studio,/onWalletGenerate=\{onWalletGenerate\}/);
 assert.match(studio,/RealizoTemplateCreator/);
});
