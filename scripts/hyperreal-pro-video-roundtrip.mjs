// One-time synthetic MP4 D1 roundtrip: no customer video, no credits, no MuAPI.
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {HyperrealD1} from './hyperreal-pro-db.mjs';
const db=new HyperrealD1(process.env.CLOUDFLARE_API_TOKEN);
const table='realizo_hyperreal_v2_mp4_roundtrip_probe';
const tmp=mkdtempSync(join(tmpdir(),'realizo-mp4-roundtrip-'));
const path=join(tmp,'synthetic.mp4');
const ff=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error',
 '-f','lavfi','-i','testsrc2=size=480x854:rate=24:duration=6',
 '-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p',
 '-movflags','+faststart',path],{encoding:'utf8',timeout:120000});
if(ff.status!==0)throw Error('synthetic_ffmpeg_failed');
const original=readFileSync(path);
if(original.length<80000||original.length>3000000)throw Error('synthetic_video_size_invalid');
const hash=x=>createHash('sha256').update(x).digest('hex');
const CHUNK=40000,parts=Math.ceil(original.length/CHUNK);
if(parts<3)throw Error('synthetic_video_needs_multiple_parts');
try{
 await db.query('CREATE TABLE IF NOT EXISTS '+table+'(chunk_index INTEGER PRIMARY KEY,data BLOB NOT NULL)');
 for(let i=0;i<parts;i++){
  const chunk=original.subarray(i*CHUNK,(i+1)*CHUNK);
  await db.query("INSERT OR REPLACE INTO "+table+" VALUES("+i+",X'"+chunk.toString('hex')+"')");
 }
 const rows=await db.query('SELECT chunk_index,hex(data) AS bytes FROM '+table+' ORDER BY chunk_index ASC');
 if(rows.length!==parts)throw Error('video_roundtrip_chunk_count_mismatch');
 const restored=Buffer.concat(rows.map(x=>Buffer.from(x.bytes,'hex')));
 if(hash(restored)!==hash(original))throw Error('synthetic_video_roundtrip_sha_mismatch');
 console.log('HYPERREAL_MP4_BLOB_ROUNDTRIP_SUCCESS=true');
 console.log('HYPERREAL_MP4_CHUNKS='+parts+' TOTAL_BYTES='+original.length);
 console.log('NO_CUSTOMER_VIDEO_NO_API_CREDITS=true');
}finally{
 await db.query('DELETE FROM '+table).catch(()=>{});
 await db.query('DROP TABLE IF EXISTS '+table).catch(()=>{});
}
