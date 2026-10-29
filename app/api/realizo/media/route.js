import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {allowedUpload,sniffImageMime,MEDIA_LIFETIME,signedMediaUrl} from '@/lib/realizo-creative/media';
import {nowSeconds} from '@/lib/realizo-auth/crypto';
export const dynamic='force-dynamic';
export async function POST(request) {
  if(!enforceSameOrigin(request))return Response.json({error:'invalid_origin'},{status:403});
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    if(env.REALIZO_AUTH_PROVIDER!=='native')
      return Response.json({error:'media_not_configured'},{status:503});
    if(Number(request.headers.get('content-length')||0)>9*1024*1024)
      return Response.json({error:'image_too_large'},{status:413});
    const form=await request.formData();
    const file=form.get('image');
    if(!allowedUpload(file))return Response.json({error:'invalid_image'},{status:400});
    const day=nowSeconds()-86400;
    const quota=await env.WALLETS_DB.prepare(
      'SELECT COUNT(*) AS n,COALESCE(SUM(byte_size),0) AS bytes FROM realizo_media_assets WHERE user_id=? AND created_at>?'
    ).bind(user.id,day).first();
    if(Number(quota?.n||0)>=30 || Number(quota?.bytes||0)+file.size>90*1024*1024)
      return Response.json({error:'daily_upload_limit'},{status:429});
    const buffer=new Uint8Array(await file.arrayBuffer());
    if(sniffImageMime(buffer)!==file.type)
      return Response.json({error:'invalid_image_content'},{status:400});
    const id=crypto.randomUUID(), objectKey=user.id+'/'+id;
    const expires=nowSeconds()+MEDIA_LIFETIME;
    const r2=Boolean(env.REALIZO_MEDIA);
    if(!r2 && (env.REALIZO_ENV!=='sandbox'||buffer.length>900000))
      return Response.json({error:'image_too_large_for_sandbox'},{status:413});
    const location=r2?objectKey:'d1:'+objectKey;
    if(r2){
      await env.REALIZO_MEDIA.put(objectKey,buffer,{
        httpMetadata:{contentType:file.type,cacheControl:'private,no-store'},
        customMetadata:{assetId:id,ownerId:user.id},
      });
    }
    try{
      await env.WALLETS_DB.prepare(
        'INSERT INTO realizo_media_assets (id,user_id,object_key,content_type,byte_size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)'
      ).bind(id,user.id,location,file.type,buffer.length,nowSeconds(),expires).run();
      if(!r2)await env.WALLETS_DB.prepare(
        'INSERT INTO realizo_media_binary_sandbox (asset_id,body) VALUES (?,?)'
      ).bind(id,buffer).run();
    }catch(e){
      if(r2)await env.REALIZO_MEDIA.delete(objectKey);
      else await env.WALLETS_DB.prepare('DELETE FROM realizo_media_assets WHERE id=?').bind(id).run();
      throw e;
    }
    return Response.json({id,url:await signedMediaUrl(env,id,expires),content_type:file.type},{
      status:201,headers:{'Cache-Control':'no-store'}
    });
  }catch(e){return jsonError(e)}
}
