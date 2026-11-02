import { getWalletEnvironment } from '@/lib/wallet/server';
import { sameOrigin } from '@/lib/realizo-auth/crypto';
import { requestEmailCode } from '@/lib/realizo-auth/email';
export const dynamic='force-dynamic';
export async function POST(request) {
  try {
    const env=await getWalletEnvironment();
    if(!sameOrigin(request,env)) return Response.json({error:'invalid_origin'},{status:403});
    if(Number(request.headers.get('content-length')||0)>4096) return Response.json({error:'too_large'},{status:413});
    const json=await request.json();
    const result=await requestEmailCode(env,json?.email,request.headers.get('cf-connecting-ip'));
    if(!result.ok) return Response.json({error:'invalid_email'},{status:400});
    return Response.json({sent:true,message:'Si el correo es válido, recibirá un código de acceso.'},{
      headers:{'Cache-Control':'no-store'}
    });
  }catch(error){
    if(error?.message==='realizo_email_not_configured' || error?.message==='realizo_auth_not_configured')
      return Response.json({error:'login_not_configured'},{status:503});
    console.error('Realizo email login unavailable');
    return Response.json({error:'email_unavailable'},{status:503});
  }
}
