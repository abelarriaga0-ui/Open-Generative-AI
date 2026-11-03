import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {isConversionImageGenerationEnabled} from '@/lib/wallet/generation-policy';
import {isSafePublicImageUrl} from '@/lib/conversion-templates/catalog';
export const dynamic='force-dynamic';
const TYPES=new Set(['image/jpeg','image/png','image/webp']);
const MAX=10*1024*1024;
export async function POST(request){
 if(!enforceSameOrigin(request))return Response.json({error:'invalid_origin'},{status:403});
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return Response.json({error:'not_authenticated'},{status:401});
  if(!isConversionImageGenerationEnabled(env))return Response.json({error:'images_not_ready'},{status:503});
  if(Number(request.headers.get('content-length')||0)>MAX+16000)return Response.json({error:'image_too_large'},{status:413});
  const data=await request.formData();
  const file=data.get('product');
  if(!file||typeof file.arrayBuffer!=='function'||!TYPES.has(file.type)||file.size<1||file.size>MAX)
    return Response.json({error:'invalid_product_image'},{status:400});
  // Uploads are owned by the current wallet user; clients cannot supply an arbitrary URL.
  const form=new FormData();
  form.append('file',file,file.name||'producto.webp');
  const remote=await fetch('https://api.muapi.ai/api/v1/upload_file',{
   method:'POST',headers:{'x-api-key':env.MUAPI_API_KEY},body:form,signal:AbortSignal.timeout(45000)
  });
  if(!remote.ok)return Response.json({error:'provider_upload_failed'},{status:502});
  const output=await remote.json();
  const url=output.url||output.file_url||output.data?.url;
  if(!isSafePublicImageUrl(url))return Response.json({error:'provider_upload_invalid'},{status:502});
  const id=crypto.randomUUID();
  await env.WALLETS_DB.prepare('INSERT INTO realizo_image_uploads(id,user_id,image_url) VALUES(?,?,?)')
   .bind(id,user.id,url).run();
  return Response.json({upload_id:id},{headers:{'Cache-Control':'private,no-store'}});
 }catch(error){return jsonError(error);}
}
