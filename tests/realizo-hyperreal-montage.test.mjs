import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {montageHyperrealScenes,inspectHyperrealVideo} from '../scripts/hyperreal-pro-montage.mjs';

const dir=mkdtempSync(join(tmpdir(),'realizo-hyperreal-montage-test-'));
function run(args){
 const j=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error',...args],
  {encoding:'utf8',timeout:120000,maxBuffer:150000});
 assert.equal(j.status,0,'FFmpeg unavailable: '+j.stderr);
}
function clip(color,index,{audio=true}={}){
 const file=join(dir,'scene-'+color+'-'+index+'.mp4');
 run(['-f','lavfi','-i','color=c='+color+':s=270x480:r=24:d=3',
  ...(audio?['-f','lavfi','-i','sine=frequency='+(300+index*110)+':duration=3']:[]),
  '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',
  ...(audio?['-c:a','aac','-shortest']:['-an']),
  file]);
 return file;
}
test('FFmpeg montage builds one 9s real MP4 from three independent video clips',()=>{
 const inputs=['red','green','blue'].map((c,i)=>clip(c,i));
 const target=join(dir,'final.mp4');
 const meta=montageHyperrealScenes(inputs,{
  aspectRatio:'9:16',audioMode:'camera',expectedDurations:[3,3,3]
 },target);
 assert.ok(existsSync(target));
 assert.ok(statSync(target).size>10000);
 assert.ok(Math.abs(meta.duration-9)<1.8);
 assert.equal(meta.video,true);
 assert.equal(meta.audio,true);
});
test('speech-enabled mode rejects missing audio, no-voice mode can montage it',()=>{
 const files=['black','white'].map((c,i)=>clip(c,i+4,{audio:false}));
 assert.throws(()=>montageHyperrealScenes(files,{
  audioMode:'camera',expectedDurations:[3,3]
 },join(dir,'fail.mp4')),/hyperreal_montage_audio_missing/);
 const output=join(dir,'silent.mp4');
 const meta=montageHyperrealScenes(files,{
  audioMode:'none',expectedDurations:[3,3]
 },output);
 assert.equal(meta.video,true);
 assert.ok(inspectHyperrealVideo(output).duration>=5.5);
});
