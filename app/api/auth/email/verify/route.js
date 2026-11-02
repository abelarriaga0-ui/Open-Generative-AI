import { NextResponse } from 'next/server';
import { getWalletEnvironment } from '@/lib/wallet/server';
import { sameOrigin } from '@/lib/realizo-auth/crypto';
import { verifyEmailCode } from '@/lib/realizo-auth/email';
import { findOrCreateAccount } from '@/lib/realizo-auth/accounts';
import { createOwnSession } from '@/lib/realizo-auth/session';
export const dynamic='force-dynamic';
export async function POST(request){
  try{
    const env=await getWalletEnvironment();
    if(!sameOrigin(request,env)) return NextResponse.json({error:'invalid_origin'},{status:403});
    if(Number(request.headers.get('content-length')||0)>4096) return NextResponse.json({error:'too_large'},{status:413});
    const body=await request.json();
    const email=await verifyEmailCode(env,body?.email,body?.code);
    if(!email)return NextResponse.json({error:'invalid_or_expired_code'},{status:401});
    const user=await findOrCreateAccount(env.WALLETS_DB,email,'email',email);
    return await createOwnSession(env,user.id,NextResponse.json({authenticated:true}));
  }catch(error){
    if(error?.message==='realizo_auth_not_configured')return NextResponse.json({error:'login_not_configured'},{status:503});
    console.error('Realizo email verification unavailable');
    return NextResponse.json({error:'authentication_unavailable'},{status:503});
  }
}
