// Non-billing Cloudflare D1 write/read probe for bounded 700k video chunks.
// Uses a dedicated temporary table; never touches any wallet or user record.
import {HyperrealD1} from './hyperreal-pro-db.mjs';
const db=new HyperrealD1(process.env.CLOUDFLARE_API_TOKEN);
const table='realizo_hyperreal_v2_chunk_probe';
try{
 await db.query('CREATE TABLE IF NOT EXISTS '+table+'(slot INTEGER PRIMARY KEY,data BLOB)');
 const bytes=Buffer.alloc(180000,0x32);
 await db.query("INSERT OR REPLACE INTO "+table+"(slot,data) VALUES (1,X'"+bytes.toString('hex')+"')");
 const results=await db.query('SELECT length(data) AS n FROM '+table+' WHERE slot=1');
 if(Number(results?.[0]?.n)!==bytes.length)throw Error('chunk_limit_verification_failed');
 console.log('HYPERREAL_D1_CHUNK_WRITE_READ_SIZE='+bytes.length);
 console.log('NO_PAYPAL_NO_VIDEO_NO_AI_CALLS=true');
}finally{
 await db.query('DELETE FROM '+table).catch(()=>{});
 await db.query('DROP TABLE IF EXISTS '+table).catch(()=>{});
}
