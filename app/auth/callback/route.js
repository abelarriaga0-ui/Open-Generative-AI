import { NextResponse } from 'next/server';
import { createRealizoServerAuth } from '@/lib/realizo-auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const safeFailure = () => NextResponse.redirect(new URL('/login?error=authentication', url.origin));
  if (!code || code.length > 4096) return safeFailure();
  const auth = await createRealizoServerAuth();
  if (!auth) return safeFailure();
  const { error } = await auth.auth.exchangeCodeForSession(code);
  if (error) return safeFailure();
  const { data, error: verifyError } = await auth.auth.getUser();
  if (verifyError || !data?.user || data.user.is_anonymous) return safeFailure();
  return NextResponse.redirect(new URL('/wallet', url.origin), 303);
}
