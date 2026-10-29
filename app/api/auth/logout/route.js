import { NextResponse } from 'next/server';
import { createRealizoServerAuth } from '@/lib/realizo-auth/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';

export const dynamic = 'force-dynamic';
export async function POST(request) {
  if (!enforceSameOrigin(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const auth = await createRealizoServerAuth();
  if (auth) await auth.auth.signOut();
  return NextResponse.json({ signed_out: true }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
