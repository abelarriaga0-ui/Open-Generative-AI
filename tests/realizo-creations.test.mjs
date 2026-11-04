import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Mis creaciones sustituye Mis videos en navegación y conserva acceso desde inicio',()=>{
  const studio=read('components/RealizoStudio.jsx');
  const home=read('components/RealizoMotionHome.jsx');
  assert.match(studio,/>Mis creaciones<\/button>/);
  assert.match(studio,/nav\('videos','Mis creaciones','folder'\)/);
  assert.match(studio,/<RealizoCreationsGallery/);
  assert.match(home,/onViewVideos}>Mis creaciones/);
  assert.doesNotMatch(studio,/>Mis videos<\/button>/);
});
test('video e imagen se recuperan separadamente con sesión y se combinan por fecha',()=>{
  const studio=read('components/RealizoStudio.jsx');
  const gallery=read('components/RealizoCreationsGallery.jsx');
  const video=read('app/api/realizo/jobs/route.js');
  const image=read('app/api/realizo/images/history/route.js');
  assert.match(studio,/fetch\('\/api\/realizo\/jobs'/);
  assert.match(studio,/fetch\('\/api\/realizo\/images\/history'/);
  assert.match(gallery,/\.\.\.videos\.map/);
  assert.match(gallery,/\.\.\.images\.map/);
  assert.match(gallery,/sort\(\(a,b\)/);
  assert.match(gallery,/Todos/);
  assert.match(gallery,/Imágenes/);
  assert.match(gallery,/Videos/);
  assert.match(gallery,/item\.image_url/);
  assert.match(gallery,/item\.video_url/);
  assert.match(gallery,/downloadRealizoVideo/);
  assert.match(gallery,/onSaveVideoTemplate/);
  assert.match(video,/requireWalletUser/);
  assert.match(image,/requireWalletUser/);
});
test('sección Mis creaciones admite entrada directa y alias anterior',()=>{
  const route=read('app/studio/[[...slug]]/page.js');
  assert.match(route,/creations/);
  assert.match(route,/videos/);
  assert.match(route,/initialPage/);
});
test('progreso de imagen crece con el tiempo sin afirmar porcentaje exacto falso',()=>{
  const generator=read('components/ConversionTemplatesStudio.jsx');
  const jobs=read('app/api/wallet/jobs/[id]/route.js');
  assert.match(generator,/setInterval\(update,1000\)/);
  assert.match(generator,/provider_progress_percent/);
  assert.match(generator,/progressPercent/);
  assert.match(generator,/progressbar/);
  assert.match(generator,/estimado/);
  assert.match(generator,/Límite:/);
  assert.match(generator,/onViewCreations/);
  assert.match(jobs,/provider_progress_percent/);
});
