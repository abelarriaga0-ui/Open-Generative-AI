// Public Supabase Auth settings are only enabled for the explicit Realizo auth pilot.
// Never use Supabase service-role keys or connect another project's database here.
export function publicAuthConfig() {
  const url = process.env.NEXT_PUBLIC_REALIZO_AUTH_URL || '';
  const key = process.env.NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY || '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || !key.trim()) return null;
  return { url: url.replace(/\/$/, ''), key };
}
