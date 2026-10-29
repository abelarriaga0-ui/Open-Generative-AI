import { getWalletEnvironment } from '@/lib/wallet/server';
import { emailEnabled } from '@/lib/realizo-auth/email';
import { googleEnabled } from '@/lib/realizo-auth/google';
export const dynamic='force-dynamic';
export async function GET() {
  try {
    const env=await getWalletEnvironment();
    const enabled=env.REALIZO_AUTH_PROVIDER==='native' && Boolean(env.REALIZO_AUTH_PEPPER);
    return Response.json({
      enabled,
      email:enabled && emailEnabled(env),
      google:enabled && googleEnabled(env),
      sandbox:env.REALIZO_ENV==='sandbox',
    },{headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({enabled:false,email:false,google:false,sandbox:true},{
      headers:{'Cache-Control':'no-store'}
    });
  }
}
