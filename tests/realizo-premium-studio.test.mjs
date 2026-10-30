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
test('premium Realizo video editor docks its controls instead of a black modal',()=>{
  const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
  const wrapper=readFileSync('components/RealizoStudio.jsx','utf8');
  const styles=readFileSync('app/globals.css','utf8');
  assert.match(wrapper,/realizo-native-video/);
  assert.match(editor,/realizoBrand \? "realizo-docked-composer/);
  assert.match(editor,/panelClassName=\{realizoBrand \? "realizo-premium-composer"/);
  assert.match(editor,/realizo-visual-empty/);
  assert.match(editor,/Tu idea cobra vida/);
  assert.match(editor,/realizo-generation-action/);
  assert.match(styles,/\.realizo-native-video \.realizo-premium-composer/);
  assert.match(styles,/background: #fffefc !important/);
  assert.match(styles,/background: #6e4bd2 !important/);
});
test('original engine and safe billing gates are preserved unchanged',()=>{
  const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
  assert.match(editor,/onWalletGenerate && generationReady/);
  assert.match(editor,/previewOnly && !generationReady/);
  const guard=readFileSync('lib/wallet/generation-policy.js','utf8');
  assert.match(guard,/REALIZO_MUAPI_PILOT_ACCOUNT_ID/);
});
