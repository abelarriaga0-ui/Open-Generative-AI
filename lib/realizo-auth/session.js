import { cookies } from 'next/headers';
import { assertOwnAuthConfig, nowSeconds, randomToken, sha256 } from './crypto.js';
export const SESSION_COOKIE = '__Host-realizo_session';
export const SESSION_LIFETIME_SECONDS = 7 * 24 * 3600;
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_LIFETIME_SECONDS,
};
export async function getOwnSession(env) {
  if (env.REALIZO_AUTH_PROVIDER !== 'native') return null;
  assertOwnAuthConfig(env);
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw || !/^[A-Za-z0-9_-]{40,128}$/.test(raw)) return null;
  const hashed = await sha256(raw);
  const row = await env.WALLETS_DB.prepare(
    'SELECT a.id,a.email,s.expires_at FROM realizo_sessions s JOIN realizo_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?'
  ).bind(hashed, nowSeconds()).first();
  return row ? { id: row.id, email: row.email } : null;
}
export async function createOwnSession(env, accountId, response) {
  assertOwnAuthConfig(env);
  const token = randomToken();
  const stamp = nowSeconds();
  await env.WALLETS_DB.prepare(
    'INSERT INTO realizo_sessions (token_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)'
  ).bind(await sha256(token), accountId, stamp, stamp + SESSION_LIFETIME_SECONDS).run();
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export async function clearOwnSession(env, response) {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (raw && env.REALIZO_AUTH_PROVIDER === 'native') {
    await env.WALLETS_DB.prepare('UPDATE realizo_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL')
      .bind(nowSeconds(), await sha256(raw)).run();
  }
  response.cookies.set(SESSION_COOKIE, '', {...SESSION_COOKIE_OPTIONS, maxAge:0});
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
