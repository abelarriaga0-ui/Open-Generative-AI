// Non-billing D1 REST payload threshold probe using a temporary table only.
import {HyperrealD1} from './hyperreal-pro-db.mjs';
const db=new HyperrealD1(process.env.CLOUDFLARE_API_TOKEN);
const table='realizo_hyperreal_v2_chunk_probe';
let largest=0;
try{
 console.log('HYPERREAL_PROBE_PHASE=create');
 await db.query('CREATE TABLE IF NOT EXISTS '+table+'(slot INTEGER PRIMARY KEY,data BLOB)');
 for(const size of [40000,45000,50000,60000]){
  const bytes=Buffer.alloc(size,0x32);
  try{
   console.log('HYPERREAL_PROBE_PHASE=insert size='+size);
   await db.query("INSERT OR REPLACE INTO "+table+"(slot,data) VALUES (1,X'"+bytes.toString('hex')+"')");
   const result=await db.query('SELECT length(data) AS n FROM '+table+' WHERE slot=1');
   if(Number(result?.[0]?.n)!==size)throw Error('length_mismatch');
   largest=size;
   console.log('HYPERREAL_D1_CHUNK_OK='+size);
  }catch{
   console.log('HYPERREAL_D1_CHUNK_REJECTED='+size);
   break;
  }
 }
 if(largest<40000)throw Error('hyperreal_d1_too_small_for_bounded_delivery');
 console.log('HYPERREAL_D1_SAFE_MAX_PROBED_BYTES='+largest);
 console.log('NO_PAYPAL_NO_VIDEO_NO_AI_CALLS=true');
}finally{
 await db.query('DELETE FROM '+table).catch(()=>{});
 await db.query('DROP TABLE IF EXISTS '+table).catch(()=>{});
}
