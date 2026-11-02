import { NextResponse } from 'next/server';
import { getWalletEnvironment } from '@/lib/wallet/server';
import { sameOrigin } from '@/lib/realizo-auth/crypto';
import { clearOwnSession } from '@/lib/realizo-auth/session';
export const dynamic='force-dynamic';
export async function POST(request){
  try{
    const env=await getWalletEnvironment();
    if(!sameOrigin(request,env))return NextResponse.json({error:'invalid_origin'},{status:403});
    return clearOwnSession(env,NextResponse.json({ok:true}));
  }catch{return NextResponse.json({error:'logout_unavailable'},{status:503});}
}
