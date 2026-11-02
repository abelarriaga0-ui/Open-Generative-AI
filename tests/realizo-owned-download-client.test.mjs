import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadRealizoVideo} from '../lib/realizo-creative/download-video.js';

const original={fetch:globalThis.fetch,document:globalThis.document,
  create:URL.createObjectURL,revoke:URL.revokeObjectURL};
test.after(()=>{globalThis.fetch=original.fetch;globalThis.document=original.document;
  URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;});
const ID='21797787-63de-48e3-b895-06396b1e55a9';
function mockDocument(){
 let clicked=0;
 globalThis.document={
  body:{appendChild:()=>{}},
  createElement:tag=>{
   assert.equal(tag,'a');
   return {style:{},remove:()=>{},click:()=>{clicked++}};
  },
 };
 URL.createObjectURL=()=> 'blob:realizo-download';
 URL.revokeObjectURL=()=>{};
 return ()=>clicked;
}
test('owned MP4 returns clickable fallback and triggers direct browser download',async()=>{
 const clicks=mockDocument();
 const fetched=[];
 globalThis.fetch=async(url,options)=>{
  fetched.push({url,options});
  return new Response(new Uint8Array([0,0,0,24,102,116,121,112]),{
   status:200,headers:{'Content-Type':'video/mp4','Content-Length':'8'}});
 };
 const progress=[];
 const result=await downloadRealizoVideo(ID,{onProgress:x=>progress.push(x)});
 assert.equal(result.url,'blob:realizo-download');
 assert.equal(result.filename,'realizo-'+ID+'.mp4');
 assert.equal(clicks(),1);
 assert.equal(fetched[0].url,'/api/realizo/jobs/'+ID+'/download');
 assert.equal(fetched[0].options.method,'POST');
 assert.equal(fetched[0].options.credentials,'same-origin');
 assert.ok(progress.some(p=>p.loaded===8));
});
test('server video-not-available rejects with visible Spanish error instead of silent iframe',async()=>{
 mockDocument();
 globalThis.fetch=async()=>Response.json({error:'video_not_available'},{status:404});
 await assert.rejects(downloadRealizoVideo(ID),/archivo todavía no está disponible/);
});
test('HTTP 502 and non-video success return actionable error',async()=>{
 mockDocument();
 globalThis.fetch=async()=>Response.json({error:'video_unavailable'},{status:502});
 await assert.rejects(downloadRealizoVideo(ID),/recuperar el archivo/);
 globalThis.fetch=async()=>Response.json({ok:true});
 await assert.rejects(downloadRealizoVideo(ID),/no contiene un video válido/);
});
test('reject invalid identifiers before fetch',async()=>{
 mockDocument();
 globalThis.fetch=async()=>{throw new Error('should not request network')};
 await assert.rejects(downloadRealizoVideo('untrusted'),/identificar tu video/);
});
