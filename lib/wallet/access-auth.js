// Cloudflare Access is a temporary, verified identity provider for the wallet pilot.
// IMPORTANT: configure an Access application policy protecting this worker.
// Do not trust client-supplied user_id or unverified CF-Access headers.
function decodeSegment(segment) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function parseJsonSegment(segment) {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

function getIssuer(teamDomain) {
  const host = String(teamDomain || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9-]+(?:\.cloudflareaccess\.com)?$/.test(host)) return null;
  return 'https://' + (host.endsWith('.cloudflareaccess.com') ? host : host + '.cloudflareaccess.com');
}

export async function verifyAccessUser(request, env) {
  const issuer = getIssuer(env?.CF_ACCESS_TEAM_DOMAIN);
  const audience = env?.CF_ACCESS_AUD;
  if (!issuer || !audience) return null; // Fail closed until Access is configured.
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 16000) return null;
  try {
    const header = parseJsonSegment(parts[0]);
    const claims = parseJsonSegment(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== issuer || typeof claims.sub !== 'string' || !claims.sub ||
        typeof claims.exp !== 'number' || claims.exp <= now ||
        (typeof claims.nbf === 'number' && claims.nbf > now + 60) ||
        !Array.isArray(claims.aud) || !claims.aud.includes(audience)) {
      return null;
    }
    const response = await fetch(issuer + '/cdn-cgi/access/certs', { cache: 'no-store' });
    if (!response.ok) return null;
    const { keys } = await response.json();
    const jwk = keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5', publicKey,
      decodeSegment(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1])
    );
    if (!valid) return null;
    return { provider: 'cloudflare-access', subject: claims.sub, email: claims.email || null };
  } catch {
    return null;
  }
}

export function enforceSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return false;
  return true;
}
