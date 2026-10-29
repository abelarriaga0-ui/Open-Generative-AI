import { createRealizoServerAuth } from '@/lib/realizo-auth/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await createRealizoServerAuth();
  if (!auth) return Response.json({ configured: false, authenticated: false }, {
    headers: { 'Cache-Control': 'no-store' }
  });
  const { data, error } = await auth.auth.getUser();
  const user = error ? null : data?.user;
  return Response.json({
    configured: true,
    authenticated: Boolean(user?.id && !user.is_anonymous),
    email: user?.email || null,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
