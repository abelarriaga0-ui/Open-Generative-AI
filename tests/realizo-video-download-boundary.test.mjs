import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {extractOwnedDownloadUrl} from '../lib/realizo-creative/download-policy.js';
import {TEMPLATE_PREVIEW_SRC} from '../lib/realizo-creative/template-video-input.js';
const read=p=>readFileSync(p,'utf8');
test('preview never offers native video download controls or external provider fallback',()=>{
  const library=read('components/RealizoTemplateLibrary.jsx');
  assert.equal(TEMPLATE_PREVIEW_SRC,'/assets/realizo/templates/ugc-preview-30s.mp4');
  assert.match(library,/controlsList="nodownload noremoteplayback noplaybackrate"/);
  assert.match(library,/onContextMenu=\{blockSave\}/);
  assert.match(library,/realizo-template-safe-player/);
  assert.match(library,/realizo-template-preview-mark/);
  assert.doesNotMatch(library,/src=\{source\} controls\b|TEMPLATE_PREVIEW_PROVIDER_SRC/);
  assert.equal(existsSync('public/assets/realizo/templates/ugc-master-30s.mp4'),false);
  assert.ok(statSync('public/assets/realizo/templates/ugc-preview-30s.mp4').size<1000000);
});
test('all generated videos use owner-only download button, not provider download links',()=>{
 const creator=read('components/RealizoTemplateCreator.jsx');
 const history=read('components/RealizoStudio.jsx');
 assert.match(creator,/downloadRealizoVideo\(jobId\)/);
 assert.match(history,/downloadRealizoVideo\(job\.id\)/);
 assert.match(history,/MutationObserver\(protect\)/);
 assert.doesNotMatch(history,/href=\{job\.video_url\}/);
 assert.doesNotMatch(creator,/href=\{generated\}/);
 const editor=read('packages/studio/src/components/VideoStudio.jsx');
 assert.match(editor,/downloadRealizoVideo\(String\(entry\.id\)\)/);
 assert.match(editor,/realizoBrand/);
});
test('completed video download endpoint requires session ownership and POST',()=>{
 const route=read('app/api/realizo/jobs/[id]/download/route.js');
 assert.match(route,/export async function POST\(/);
 assert.match(route,/enforceSameOrigin\(request\)/);
 assert.match(route,/requireWalletUser\(request,env\)/);
 assert.match(route,/getGenerationJob\(env\.WALLETS_DB,user\.id,id\)/);
 assert.match(route,/Content-Disposition/);
 assert.match(route,/attachment;/);
 assert.match(route,/Cache-Control/);
});
test('download resolver rejects other users, unfinished jobs and untrusted URLs',()=>{
 const output='https://cdn.muapi.ai/outputs/generated/21797787-63de-48e3-b895-06396b1e55a9_07f12652.mp4';
 assert.equal(extractOwnedDownloadUrl({status:'completed',result_json:JSON.stringify({outputs:[output]})}),output);
 assert.equal(extractOwnedDownloadUrl({status:'submitted',result_json:JSON.stringify({outputs:[output]})}),null);
 assert.equal(extractOwnedDownloadUrl({status:'completed',result_json:JSON.stringify({outputs:['https://evil.example/video.mp4']})}),null);
});
