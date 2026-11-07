import {spawnSync} from 'node:child_process';

function command(executable,args,limit=300000){
 const response=spawnSync(executable,args,{
  encoding:'utf8',maxBuffer:1024*1024,timeout:limit
 });
 if(response.error||response.status!==0)throw Error('hyperreal_ffmpeg_failed');
 return response.stdout||'';
}
export function inspectHyperrealVideo(file){
 const result=command('ffprobe',['-v','error',
  '-show_entries','stream=codec_type:format=duration',
  '-of','json',file]);
 let info;try{info=JSON.parse(result);}catch{throw Error('hyperreal_probe_invalid');}
 const duration=Number(info.format?.duration);
 if(!Number.isFinite(duration)||duration<2.5||duration>60)
  throw Error('hyperreal_probe_duration_invalid');
 return {
  duration,
  video:(info.streams||[]).some(x=>x.codec_type==='video'),
  audio:(info.streams||[]).some(x=>x.codec_type==='audio')
 };
}
export function montageHyperrealScenes(files,{aspectRatio='9:16',audioMode='camera',expectedDurations=[]},target){
 if(!Array.isArray(files)||files.length<2||files.length>10||
    !Array.isArray(expectedDurations)||expectedDurations.length!==files.length)
  throw Error('hyperreal_montage_inputs_invalid');
 if(!['9:16','16:9'].includes(aspectRatio)||
    !['camera','voiceover','none'].includes(audioMode))
  throw Error('hyperreal_montage_format_invalid');
 const voice=audioMode!=='none';
 const duration=expectedDurations.reduce((a,b)=>a+Number(b),0);
 if(!Number.isFinite(duration)||duration<6||duration>60)
  throw Error('hyperreal_montage_duration_invalid');
 for(let i=0;i<files.length;i++){
  const meta=inspectHyperrealVideo(files[i]);
  if(!meta.video)throw Error('hyperreal_montage_video_missing');
  if(voice&&!meta.audio)throw Error('hyperreal_montage_audio_missing');
  if(Math.abs(meta.duration-Number(expectedDurations[i]))>2)
   throw Error('hyperreal_montage_duration_mismatch');
 }
 const vertical=aspectRatio==='9:16';
 const width=vertical?1080:1920,height=vertical?1920:1080;
 const filter=[];
 for(let i=0;i<files.length;i++){
  filter.push('['+i+':v]fps=30,scale='+width+':'+height+
   ':force_original_aspect_ratio=increase,crop='+width+':'+height+
   ',setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v'+i+']');
  if(voice)filter.push('['+i+':a]aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[a'+i+']');
 }
 filter.push(files.map((_,i)=>'[v'+i+']'+(voice?'[a'+i+']':'')).join('')+
  'concat=n='+files.length+':v=1:a='+(voice?'1':'0')+
  '[outv]'+(voice?'[outa]':''));
 command('ffmpeg',['-y','-hide_banner','-loglevel','error',
  ...files.flatMap(x=>['-i',x]),
  '-filter_complex',filter.join(';'),'-map','[outv]',
  ...(voice?['-map','[outa]','-c:a','aac','-b:a','128k']:['-an']),
  '-c:v','libx264','-preset','veryfast','-crf','26',
  '-pix_fmt','yuv420p','-movflags','+faststart','-r','30',target
 ]);
 const finished=inspectHyperrealVideo(target);
 if(Math.abs(finished.duration-duration)>1.8)
  throw Error('hyperreal_montage_final_duration_mismatch');
 if(voice){
  const result=spawnSync('ffmpeg',['-hide_banner','-i',target,
   '-af','silencedetect=noise=-50dB:d=2','-f','null','-'],{
   encoding:'utf8',maxBuffer:150000,timeout:90000
  });
  if(result.error||result.status!==0)throw Error('hyperreal_montage_audio_invalid');
  if(/silence_duration:\s*(?:[3-9]|[1-9]\d)/.test(result.stderr||''))
   throw Error('hyperreal_montage_unwanted_silence');
 }
 return finished;
}
