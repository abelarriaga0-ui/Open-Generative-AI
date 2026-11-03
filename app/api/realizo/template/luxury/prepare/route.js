import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {isOwnedSignedProductImage} from '@/lib/wallet/muapi-pilot';
import {makeLuxuryProductOnlyInput} from '@/lib/realizo-creative/luxury-product-only-template';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store'};
const bad=(error,status=422)=>Response.json({error},{status,headers});

export async function POST(request){
  if(!enforceSameOrigin(request))return bad('invalid_origin',403);
  try{
    if(Number(request.headers.get('content-length')||0)>4000)return bad('request_too_large',413);
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return bad('not_authenticated',401);
    const body=await request.json();
    const imageUrl=String(body?.image_url||'');
    if(imageUrl.length>1400 || !await isOwnedSignedProductImage(env,user,imageUrl))
      return bad('invalid_media_reference',422);
    // This action only prepares a prompt. It never invokes Muapi or charges
    // the wallet: /api/wallet/quote and /api/wallet/generate do that later.
    const prepared=makeLuxuryProductOnlyInput({
      productName:body?.product_name,description:body?.description,
      imageUrl,visualDetail:body?.visual_detail||'auto'
    });
    return Response.json(prepared,{headers});
  }catch(error){
    if(['invalid_luxury_template_payload','invalid_luxury_template_prompt'].includes(error?.message))
      return bad(error.message);
    return jsonError(error);
  }
}
