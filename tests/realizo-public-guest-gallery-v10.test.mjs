import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=p=>readFileSync(p,'utf8');
const page=src('app/studio/[[...slug]]/page.js');
const studio=src('components/RealizoStudio.jsx');
const templates=src('components/RealizoTemplateLibrary.jsx');
const gallery=src('components/RealizoVisualGallery.jsx');
const css=src('app/realizo-redesign-v9.css');
const proxy=src('proxy.js');
const walletApi=src('app/api/wallet/route.js');
test('anonymous user can visit the real Studio instead of being redirected to sign-in',()=>{
 assert.match(page,/guest=\{!user\}/);
 assert.match(page,/accountId=\{user\?\.id\|\|null\}/);
 assert.doesNotMatch(page,/if\s*\(!user\)\s*redirect\('\/login'\)/);
 assert.match(page,/getOwnSession\(env\)/);
 assert.match(proxy,/NextResponse.next\(\)/);
});
test('guests can explore public pages but creating or viewing credits requires login',()=>{
 assert.match(studio,/function startNewVideo\(\)\{\s*if\(guest\)return requireLogin\(\)/);
 assert.match(studio,/function chooseVisualFormat\(format\)\{\s*if\(guest\)return requireLogin\(\)/);
 assert.match(studio,/function chooseCreatorMode\(mode\)\{\s*if\(guest\)return requireLogin\(\)/);
 assert.match(studio,/function openEditor\(\)\{if\(guest\)return requireLogin\(\)/);
 assert.match(studio,/href=\{guest\?loginUrl:'\/wallet'\}/);
 assert.match(studio,/nav\('templates','Estilos e ideas'/);
 assert.match(studio,/nav\('videos','Mis videos'/);
 assert.match(studio,/Iniciar sesión/);
});
test('guest library is explicitly empty with a generate video button that signs in',()=>{
 assert.match(studio,/Aún no tienes videos generados/);
 assert.match(studio,/Generar video<\/button>/);
 assert.match(studio,/guest\?<div className="realizo-public-empty"/);
 assert.match(studio,/onClick=\{requireLogin\}/);
 assert.match(studio,/if\(guest\|\|page!=='videos'\)return/);
 assert.match(studio,/if\(guest\)return;\s*try\{/);
 assert.match(studio,/\{!guest&&premiumProjects.length>0/);
});
test('original generated photos are served locally as a demo sprite in both galleries',()=>{
 assert.match(templates,/realizo-template-photo-layer/);
 assert.match(gallery,/realizo-photo-format-image/);
 assert.doesNotMatch(templates,/realizo-template-face|realizo-template-prop/);
 assert.doesNotMatch(gallery,/realizo-scene-avatar|realizo-scene-product/);
 assert.match(css,/url\('\/assets\/realizo\/templates\/demo-photos.webp'\)/);
 assert.match(css,/realizo-public-empty/);
 assert.match(templates,/Vistas ilustrativas del estilo/);
 assert.match(gallery,/NOT\s*\n\/\/ playable video samples/);
});
test('guest mode cannot bypass server-side wallet protection',()=>{
 assert.match(studio,/if\(guest\)return requireLogin\(\)/);
 assert.match(walletApi,/requireWalletUser/);
 assert.match(src('app/wallet/page.jsx'),/r.status===401/);
});
