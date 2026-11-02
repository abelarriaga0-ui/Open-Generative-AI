import {getWalletEnvironment,requireWalletUser,getGenerationJob,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';

export const dynamic='force-dynamic';
const idPattern=/^[a-f0-9-]{36}$/i;
const isTrustedProviderVideo=value=>{
  try {
    const u=new URL(value);
    return u.protocol==='https:' && u.hostname==='cdn.muapi.ai' &&
      /^\/outputs\/[a-zA-Z0-9/_-]+\.mp4$/.test(u.pathname) && !u.search && !u.hash;
  }catch{return false;}
};
export function extractOwnedDownloadUrl(job){
  if(job?.status!=='completed'||!job.result_json)return null;
  try{
    const data=JSON.parse(job.result_json);
    const candidates=[data.url,data.output_url,data.output?.url,data.outputs?.[0]?.url,
      data.outputs?.[0],data.output?.[0]];
    return candidates.find(x=>typeof x==='string'&&isTrustedProviderVideo(x))||null;
  }catch{return null;}
}
// Full file delivery is permitted only through Realizo's explicit download action.
// A direct third-party download URL is not displayed by the player.
export async function POST(request,{params}){
  if(!enforceSameOrigin(request))return Response.json({error:'invalid_origin'},{status:403});
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    const {id}=await params;
    if(!idPattern.test(id))return Response.json({error:'invalid_job_id'},{status:400});
    const job=await getGenerationJob(env.WALLETS_DB,user.id,id);
    const url=extractOwnedDownloadUrl(job);
    if(!url)return Response.json({error:'video_not_available'},{status:404});
    const remote=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(18000)});
    if(!remote.ok||!remote.body)return Response.json({error:'video_unavailable'},{status:502});
    const len=Number(remote.headers.get('content-length')||0);
    return new Response(remote.body,{headers:{
      'Content-Type':'video/mp4',
      'Content-Disposition':'attachment; filename="realizo-'+id+'.mp4"',
      'Cache-Control':'private, no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      ...(len>0&&len<500000000?{'Content-Length':String(len)}:{})
    }});
  }catch(e){return jsonError(e);}
}
