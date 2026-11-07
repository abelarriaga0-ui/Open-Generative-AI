// Private D1 REST access for Hiperrealista PRO scheduled GitHub Actions runner.
// Do not import into browser/app routes. No logging of SQL, user data or secrets.
export const ACCOUNT='7e405c54c1a91abbdad537f7fec379a1';
export const DATABASE='2561f6c8-bfb2-4ea4-8527-7fec29188edf';
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const assertId=v=>{if(!ID.test(v||''))throw Error('invalid_private_id');return v;};
export const sqlValue=value=>"'"+String(value??'').replace(/'/g,"''")+"'";
export class HyperrealD1 {
 constructor(token){
  if(!token)throw Error('missing_cloudflare_token');
  this.token=token;
  this.url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+DATABASE+'/query';
 }
 async query(query){
  const response=await fetch(this.url,{
   method:'POST',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},
   body:JSON.stringify({sql:query}),signal:AbortSignal.timeout(35000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.success||!data.result?.[0]?.success)
   throw Error('hyperreal_d1_query_failed_HTTP_'+response.status);
  return data.result[0].results||[];
 }
 async claim(owner){
  const o=sqlValue(assertId(owner));
  const row=await this.query(
   "UPDATE realizo_hyperreal_pro_jobs SET status='processing',lease_owner="+o+
   ",lease_expires_at=unixepoch()+3600,updated_at=datetime('now') WHERE id=("+
   "SELECT id FROM realizo_hyperreal_pro_jobs WHERE status IN ('reserved','processing')"+
   " AND (lease_expires_at IS NULL OR lease_expires_at<unixepoch())"+
   " ORDER BY CASE status WHEN 'processing' THEN 0 ELSE 1 END,created_at ASC LIMIT 1)"+
   " RETURNING *"
  );
  return row[0]||null;
 }
 async update(job,stage,progress){
  assertId(job.id);
  const response=await this.query(
   "UPDATE realizo_hyperreal_pro_jobs SET stage="+sqlValue(stage)+
   ",progress_json="+sqlValue(JSON.stringify(progress))+
   ",lease_expires_at=unixepoch()+3600,updated_at=datetime('now')"+
   " WHERE id="+sqlValue(job.id)+" AND status='processing'"+
   " AND lease_owner="+sqlValue(job.lease_owner)+" RETURNING id"
  );
  if(response.length!==1)throw Error('hyperreal_runner_lease_lost');
 }
 async unlock(job,progress){
  assertId(job.id);
  const response=await this.query(
   "UPDATE realizo_hyperreal_pro_jobs SET progress_json="+sqlValue(JSON.stringify(progress))+
   ",lease_owner=NULL,lease_expires_at=NULL,updated_at=datetime('now')"+
   " WHERE id="+sqlValue(job.id)+" AND status='processing' AND lease_owner="+
    sqlValue(job.lease_owner)+" RETURNING id"
  );
  if(response.length!==1)throw Error('hyperreal_runner_lease_lost');
 }
 async needsReview(job,reason,progress){
  assertId(job.id);
  await this.query(
   "UPDATE realizo_hyperreal_pro_jobs SET status='needs_review',stage='needs_review'"+
   ",failure_code="+sqlValue(String(reason).slice(0,90))+
   ",progress_json="+sqlValue(JSON.stringify(progress))+
   ",lease_owner=NULL,lease_expires_at=NULL,updated_at=datetime('now')"+
   " WHERE id="+sqlValue(job.id)+" AND status='processing'"+
   " AND lease_owner="+sqlValue(job.lease_owner)
  );
 }
 async fail(job,reason,progress){
  assertId(job.id);
  await this.query(
   "UPDATE realizo_hyperreal_pro_jobs SET status='failed',stage='failed',"+
   "failure_code="+sqlValue(String(reason).slice(0,90))+
   ",progress_json="+sqlValue(JSON.stringify(progress))+
   ",lease_owner=NULL,lease_expires_at=NULL,updated_at=datetime('now')"+
   " WHERE id="+sqlValue(job.id)+" AND status='processing'"+
   " AND lease_owner="+sqlValue(job.lease_owner)
  );
 }
 async putChunk(job,index,buffer){
  assertId(job.id);
  if(!Number.isSafeInteger(index)||index<0||index>300||
    !Buffer.isBuffer(buffer)||buffer.length<1||buffer.length>700000)
   throw Error('hyperreal_chunk_invalid');
  await this.query(
   "INSERT OR REPLACE INTO realizo_hyperreal_pro_video_chunks(job_id,chunk_index,data) VALUES ("+
   sqlValue(job.id)+","+index+",X'"+buffer.toString('hex')+"')"
  );
 }
 async finish(job,bytes,sha256,progress,expectedChunks){
  assertId(job.id);
  if(!Number.isSafeInteger(bytes)||bytes<10000||bytes>110*1024*1024||
     !/^[a-f0-9]{64}$/.test(sha256))throw Error('hyperreal_result_invalid');
  const preflight=await this.query(
   "SELECT COUNT(*) AS n,COALESCE(SUM(length(data)),0) AS total FROM realizo_hyperreal_pro_video_chunks WHERE job_id="+sqlValue(job.id)
  );
  if(Number(preflight?.[0]?.total)!==bytes||Number(preflight?.[0]?.n)!==expectedChunks)
   throw Error('hyperreal_uploaded_video_incomplete');
  const r=await this.query(
   "UPDATE realizo_hyperreal_pro_jobs SET status='completed',stage='completed',"+
   "result_bytes="+bytes+",result_sha256="+sqlValue(sha256)+
   ",progress_json="+sqlValue(JSON.stringify(progress))+
   ",lease_owner=NULL,lease_expires_at=NULL,updated_at=datetime('now')"+
   " WHERE id="+sqlValue(job.id)+" AND status='processing'"+
   " AND lease_owner="+sqlValue(job.lease_owner)+" RETURNING id"
  );
  if(r.length!==1)throw Error('hyperreal_final_settlement_failed');
 }
}
