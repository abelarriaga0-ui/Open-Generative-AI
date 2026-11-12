import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildVideoBrief,summarizeProductDocument} from '../lib/realizo-creative/brief.js';

test('huge product dossier does not overwhelm the video model or repeat outline headers',()=>{
  const long=[
    'BLOQUE A — EL PRODUCTO','1. Identidad y ficha técnica','BLOQUE B — EL MERCADO Y EL AVATAR',
    'Diccionario de dolores (en las palabras del cliente)',
    'BLOQUE C — LA VENTA','Arquitectura del beneficio del beneficio',
    'Biblioteca de frases-bala','Hooks para anuncios',
    'Presentación: frasco de 120 ml',
    'Modo de uso: aplicar poca cantidad en el cabello.',
    'Ingredientes: agua y glicerina.',
  ].join('\n');
  const doc=summarizeProductDocument(long);
  assert.ok(doc.summary.includes('frasco de 120 ml'));
  assert.ok(!doc.summary.includes('BLOQUE C'));
  assert.ok(!doc.summary.includes('Biblioteca de frases'));
  const result=buildVideoBrief({
    productName:'Suero de cuidado', description:'Presentación en envase pequeño',
    documentText:long.repeat(80),tone:'Natural y creíble',references:2
  });
  assert.ok(result.prompt.length<1451);
  assert.ok(!result.prompt.includes('BLOQUE A'));
  assert.ok(!result.prompt.includes('BLOQUE C'));
  assert.ok(result.prompt.includes('No inventar'));
});
test('new public video creator uses the guided Seedance 2.0 flow, retaining the legacy studio assets',()=>{
  const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
  const wizard=readFileSync('components/RealizoSeedanceFlow.jsx','utf8');
  const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
  assert.match(wrapper,/<RealizoSeedanceFlow/);
  assert.match(wizard,/const MODEL_ID='seedance-2-omni-reference'/);
  assert.match(wizard,/images_list:photos\.map/);
  assert.match(wizard,/provider_progress_percent/);
  assert.match(wizard,/confirmar el cargo|Confirmar /i);
  assert.match(editor,/realizo-generation-action/);
});
test('original engine and safe billing gates are preserved unchanged',()=>{
  const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
  assert.match(editor,/onWalletGenerate && generationReady/);
  assert.match(editor,/previewOnly && !generationReady/);
  const guard=readFileSync('lib/wallet/generation-policy.js','utf8');
  assert.match(guard,/Emergency loss containment/);
  assert.match(guard,/return false;/);
});
