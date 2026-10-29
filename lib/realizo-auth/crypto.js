export function randomToken(bytes = 32) {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 128) throw new Error('invalid_token_size');
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
export async function sha256(value) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function canonicalEmail(raw) {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function nowSeconds() { return Math.floor(Date.now() / 1000); }
export function assertOwnAuthConfig(env) {
  if (env.REALIZO_AUTH_PROVIDER !== 'native' || !env.REALIZO_AUTH_PEPPER ||
      env.REALIZO_AUTH_PEPPER.length < 32) throw new Error('realizo_auth_not_configured');
}
export function sameOrigin(request, env) {
  const expected = String(env.REALIZO_AUTH_ORIGIN || '').replace(/\/$/, '');
  try {
    return expected.startsWith('https://') &&
      new URL(request.url).origin === expected &&
      request.headers.get('origin') === expected;
  } catch { return false; }
}
