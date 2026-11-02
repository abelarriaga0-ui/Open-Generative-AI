import { NextResponse } from 'next/server';
import { getWalletEnvironment } from '@/lib/wallet/server';
import { beginGoogle } from '@/lib/realizo-auth/google';
export const dynamic='force-dynamic';
export async function GET(request) {
  try{
    const env=await getWalletEnvironment();
    const origin=new URL(request.url).origin;
    if(origin!==env.REALIZO_AUTH_ORIGIN) return NextResponse.json({error:'invalid_host'},{status:403});
    return beginGoogle(env,new NextResponse(null,{status:302}));
  }catch(error){
    if(['realizo_auth_not_configured','google_oauth_not_configured'].includes(error?.message))
      return NextResponse.redirect(new URL('/login?error=google_not_configured',request.url));
    console.error('Google auth start failed');
    return NextResponse.redirect(new URL('/login?error=login_unavailable',request.url));
  }
}
