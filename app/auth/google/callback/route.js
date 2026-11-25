import {recordSecurityEvent} from '@/lib/wallet/security-events';
import { NextResponse } from 'next/server';
import { getWalletEnvironment } from '@/lib/wallet/server';
import { findOrCreateAccount } from '@/lib/realizo-auth/accounts';
import { finishGoogle,clearOauthCookie } from '@/lib/realizo-auth/google';
import { createOwnSession } from '@/lib/realizo-auth/session';
export const dynamic='force-dynamic';
export async function GET(request) {
  const fallback=() => clearOauthCookie(NextResponse.redirect(new URL('/login?error=google_login_failed',request.url)));
  try{
    const env=await getWalletEnvironment();
    if(new URL(request.url).origin!==env.REALIZO_AUTH_ORIGIN) return fallback();
    const identity=await finishGoogle(env,request);
    if(!identity){await recordSecurityEvent(env,'login_failed');return fallback();}
    const user=await findOrCreateAccount(env.WALLETS_DB,identity.email,'google',identity.subject);
    const response=NextResponse.redirect(new URL('/studio',env.REALIZO_AUTH_ORIGIN),303);
    const authenticated=await createOwnSession(env,user.id,response);
    await recordSecurityEvent(env,'login_success');
    return clearOauthCookie(authenticated);
  }catch{
    console.error('Google login failed');
    return fallback();
  }
}
