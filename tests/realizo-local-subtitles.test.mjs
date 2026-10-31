import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {subtitleChunks,scriptFromPrompt,createSubtitleTimeline,detectAudioActivity} from '../lib/realizo-creative/subtitle-timeline.js';
import {supportedSubtitleFormat} from '../lib/realizo-creative/subtitle-render-client.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';

test('subtitle timeline follows a spoken script; no extra API or charges',()=>{
 const lines=subtitleChunks('Hola, mira este producto. Lo necesitas hoy. Pídelo ahora.',{maxWords:3});
 assert.ok(lines.length>=3);
 const original=buildCommercialDirectorPackage({
  concept:{name:'UGC',angle:'beneficio',hook:'Conoce el producto',
   spoken_script:'Hola, mira este producto. Lo necesitas hoy. Pídelo ahora.',video_prompt:'Presenter with product'},
  productName:'NOIL',style:'ugc',duration:12,modelId:'seedance-2.5-intl-omni-reference',
 });
 assert.match(original.prompt,/TOP-PRIORITY AUDIO DIRECTOR/);
 assert.match(original.prompt,/first 0\.3 seconds/);
 assert.match(original.prompt,/speech gaps longer than 0\.35 seconds/);
 assert.equal(scriptFromPrompt(original.prompt),'Hola, mira este producto. Lo necesitas hoy. Pídelo ahora.');
 const timeline=createSubtitleTimeline('Hola, mira este producto. Lo necesitas hoy. Pídelo ahora.',12,{maxWords:3});
 assert.equal(timeline.length,lines.length);
 assert.ok(timeline.every(x=>x.start>=0&&x.end<=12&&x.end>x.start));
});
test('speech activity estimates a few audible windows and keeps captions in them',()=>{
 const buffer={sampleRate:1000,length:3000,numberOfChannels:1,getChannelData:()=>Float32Array.from({length:3000},(_,i)=>i>=500&&i<1550||i>=2000&&i<2700?0.6:0)};
 const ranges=detectAudioActivity(buffer);
 assert.ok(ranges.length>=1);
 const cues=createSubtitleTimeline('Hola a todos mira este producto y pídelo hoy',3,{speechRanges:ranges,offset:0.1});
 assert.ok(cues.length>1);
 assert.ok(cues[0].start>=0.1);
 assert.ok(cues[cues.length-1].end<=3);
});
test('subtitles are browser-only, offered after generation, preserve the original and have no payment calls',()=>{
 assert.equal(supportedSubtitleFormat(),null); // Node has no browser MediaRecorder.
 const renderer=readFileSync('lib/realizo-creative/subtitle-render-client.js','utf8');
 const editor=readFileSync('packages/studio/src/components/RealizoSubtitleEditor.jsx','utf8');
 const studio=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(renderer,/canvas\.captureStream/);
 assert.match(renderer,/createMediaStreamDestination/);
 assert.match(renderer,/new MediaRecorder/);
 assert.match(editor,/Agregar subtítulos/);
 assert.match(editor,/Generar subtítulos gratis/);
 assert.match(editor,/video original se conserva/);
 assert.match(studio,/Agregar subtítulos · Gratis/);
 assert.match(studio,/preparedBrief\?\.spoken_script/);
 assert.doesNotMatch(editor,/\/api\/wallet|OPENAI_API_KEY|MUAPI_API_KEY|purchase|price_cents/);
 assert.doesNotMatch(renderer,/\/api\/wallet|api\.openai\.com|api\.muapi\.ai/);
});
