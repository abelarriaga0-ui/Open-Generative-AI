import {getWalletEnvironment,jsonError} from '@/lib/wallet/server';
import {canReadSignedMedia,mediaSignature} from '@/lib/realizo-creative/media';
export const dynamic='force-dynamic';
export async function GET(request,{params}) {
  try{
    const env=await getWalletEnvironment();
    if(!env.REALIZO_AUTH_PEPPER)return Response.json({error:'not_configured'},{status:503});
    const {id}=await params;
    if(!/^[a-f0-9-]{36}$/i.test(id||''))return Response.json({error:'not_found'},{status:404});
    const query=new URL(request.url).searchParams,expiry=Number(query.get('expires'));
    const signature=query.get('sig')||'';
    if(!canReadSignedMedia(expiry) || !/^[0-9a-f]{64}$/i.test(signature))
      return Response.json({error:'invalid_media_link'},{status:403});
    const good=await mediaSignature(env.REALIZO_AUTH_PEPPER,id,expiry);
    let mismatch=0;
    for(let i=0;i<64;i++)mismatch|=good.charCodeAt(i)^signature.charCodeAt(i);
    if(mismatch!==0)return Response.json({error:'invalid_media_link'},{status:403});
    const row=await env.WALLETS_DB.prepare(
      'SELECT object_key,content_type,expires_at FROM realizo_media_assets WHERE id=? AND deleted_at IS NULL AND expires_at>?'
    ).bind(id,Math.floor(Date.now()/1000)).first();
    if(!row||expiry>row.expires_at)return Response.json({error:'not_found'},{status:404});
    let stream,size;
    if(row.object_key.startsWith('d1:')){
      if(env.REALIZO_ENV!=='sandbox')return Response.json({error:'not_found'},{status:404});
      const content=await env.WALLETS_DB.prepare('SELECT body FROM realizo_media_binary_sandbox WHERE asset_id=?').bind(id).first();
      if(!Array.isArray(content?.body))return Response.json({error:'not_found'},{status:404});
      stream=Uint8Array.from(content.body);size=stream.byteLength;
    }else{
      if(!env.REALIZO_MEDIA)return Response.json({error:'not_found'},{status:404});
      const asset=await env.REALIZO_MEDIA.get(row.object_key);
      if(!asset)return Response.json({error:'not_found'},{status:404});
      stream=asset.body;size=asset.size;
    }
    return new Response(stream,{headers:{
      'Content-Type':row.content_type,
      'Content-Length':String(size),
      'Cache-Control':'private, max-age=60',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'",
    }});
  }catch(e){return jsonError(e)}
}
