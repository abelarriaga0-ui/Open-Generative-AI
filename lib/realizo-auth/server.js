import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicAuthConfig } from './config';

// All Supabase identity checks use getUser(), which validates against Auth;
// never authorize a wallet using a client-provided user ID or getSession().user.
export async function createRealizoServerAuth() {
  const config = publicAuthConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Render-only server components cannot write cookies.
          // Route handlers and proxy can persist refreshed cookies.
        }
      },
    },
  });
}

export async function verifyRealizoAuthUser() {
  const supabase = await createRealizoServerAuth();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  const user = error ? null : data?.user;
  if (!user?.id || !/^[0-9a-f-]{36}$/i.test(user.id) ||
      user.is_anonymous === true || !user.email_confirmed_at) return null;
  return { provider: 'supabase', subject: user.id, email: user.email || null };
}
