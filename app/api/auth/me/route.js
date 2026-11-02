import { getWalletEnvironment } from '@/lib/wallet/server';
import { getOwnSession } from '@/lib/realizo-auth/session';
export const dynamic='force-dynamic';
export async function GET() {
  try{
    const env=await getWalletEnvironment();
    if(env.REALIZO_AUTH_PROVIDER!=='native') return Response.json({enabled:false,authenticated:false});
    const user=await getOwnSession(env);
    return Response.json({enabled:true,authenticated:Boolean(user),email:user?.email||null},{
      headers:{'Cache-Control':'private, no-store'}
    });
  }catch{return Response.json({enabled:false,authenticated:false},{status:503});}
}
