import {getWalletEnvironment} from '@/lib/wallet/server';
import {quoteLiveVideo} from '@/lib/wallet/live-video-models';
// Read-only sandbox network probe for external integration checks.
// No credentials, user data or provider costs are returned and no generation is requested.
export const dynamic='force-dynamic';
let previous=null, lastCheck=0;
const model='seedance-2.5-intl-omni-reference';
export async function GET(){
  const env=await getWalletEnvironment();
  if(env.REALIZO_ENV!=='sandbox')return new Response(null,{status:404});
  if(previous&&Date.now()-lastCheck<120000)
    return Response.json(previous,{headers:{'Cache-Control':'public, max-age=60'}});
  try{
    const q=await quoteLiveVideo(model,{
      duration:8,aspect_ratio:'9:16',resolution:'720p',
      prompt:'A product demonstration, vertical video.',
      images_list:['https://example.org/realizo-test-only.jpg'],
      omni_reference_task_type:'reference'
    });
    previous={ready:true,live_model_quote:q.model_id===model && q.provider_cost_cents>0};
  }catch(e){
    const code=String(e?.message||'quote_unavailable');
    previous={ready:false,stage:[
      'muapi_catalog_unavailable','muapi_rate_limited',
      'provider_price_inputs_invalid','muapi_pricing_contract_mismatch',
      'unsupported_model','unsupported_model_endpoint','model_pricing_unavailable'
    ].includes(code)?code:'unavailable'};
  }
  lastCheck=Date.now();
  return Response.json(previous,{headers:{'Cache-Control':'public, max-age=60'}});
}
