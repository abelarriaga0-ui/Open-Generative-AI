import {getWalletEnvironment,getPricedModel} from '@/lib/wallet/server';
import {isConversionImageGenerationEnabled} from '@/lib/wallet/generation-policy';
import {CREATIVE_TYPES,STYLES,GOALS,IMAGE_FORMATS} from '@/lib/realizo-images/creative';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const env=await getWalletEnvironment();
  const image=await getPricedModel(env.WALLETS_DB,env.REALIZO_TEMPLATE_IMAGE_MODEL_ID);
  const ready=Boolean(
   isConversionImageGenerationEnabled(env)&&image?.muapi_endpoint==='nano-banana-2-1-edit'&&
   image.customer_price_cents>0
  );
  return Response.json({
   available:ready,model:'Nano Banana 2.1 Edit',resolution:'4K',
   image_price_cents:image?.customer_price_cents??null,
   research_price_cents:0,
   formats:IMAGE_FORMATS,types:CREATIVE_TYPES,styles:STYLES,goals:GOALS
  },{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({available:false,image_price_cents:null,research_price_cents:null,
  formats:IMAGE_FORMATS,types:CREATIVE_TYPES,styles:STYLES,goals:GOALS},{headers:{'Cache-Control':'no-store'}});}
}
