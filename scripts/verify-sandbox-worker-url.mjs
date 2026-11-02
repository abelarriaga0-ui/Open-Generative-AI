// Verify the isolated Worker is reachable before configuring PayPal webhook.
// Only the existing Cloudflare account / dedicated workers.dev hostname is allowed.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const ACCOUNT = '7e405c54c1a91abbdad537f7fec379a1';
const NAME = 'realizo-sandbox';

async function readCloudflare(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('Falta el token limitado de Cloudflare.');
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + path, {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(15000),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) throw new Error('Cloudflare no pudo verificar la URL del Worker: HTTP ' + response.status);
  return json.result;
}

export async function verifySandboxWorkerUrl() {
  const [account, script] = await Promise.all([
    readCloudflare('/workers/subdomain'),
    readCloudflare('/workers/scripts/' + NAME + '/subdomain'),
  ]);
  const subdomain = account?.subdomain;
  if (!/^[a-z0-9-]{1,63}$/i.test(subdomain || '') || script?.enabled !== true) {
    throw new Error('Worker Sandbox no está habilitado en workers.dev.');
  }
  const origin = 'https://' + NAME + '.' + subdomain + '.workers.dev';
  // Only test read-only routes; no charge, generation or database writes.
  const legacy = await fetch(origin + '/api/v1/models', {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  if (legacy.status !== 404) {
    throw new Error('La ruta BYOK original no está bloqueada: HTTP ' + legacy.status);
  }
  const guarded = await fetch(origin + '/api/wallet', {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  if (![401, 503].includes(guarded.status)) {
    throw new Error('La billetera no está protegida sin sesión: HTTP ' + guarded.status);
  }
  const callback = origin + '/api/wallet/paypal/webhook';
  const hookResponse = await fetch(callback, {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000),
  });
  if (hookResponse.status !== 405) {
    throw new Error('La ruta de webhook no está disponible: HTTP ' + hookResponse.status);
  }
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, 'REALIZO_SANDBOX_WEBHOOK_URL=' + callback + '\n');
  }
  console.log('Worker Sandbox verificado: rutas BYOK bloqueadas, billetera protegida, webhook disponible.');
  console.log('URL de pruebas: ' + origin + '/wallet');
  return callback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await verifySandboxWorkerUrl(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
