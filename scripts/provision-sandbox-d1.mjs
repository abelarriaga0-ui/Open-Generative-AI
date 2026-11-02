// Provision ONLY the dedicated Realizo Sandbox D1. Never mutate the original database.
// Called by the tightly scoped GitHub Actions workflow using a masked API token.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SANDBOX_NAME = 'realizo-wallets-sandbox';
const PLACEHOLDER = '00000000-0000-0000-0000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function planSandboxD1({ sandbox, original, existing }) {
  const db = sandbox?.d1_databases?.find(item => item.binding === 'WALLETS_DB');
  const primaryIds = (original?.d1_databases || []).map(item => item.database_id?.toLowerCase());
  if (sandbox?.name !== 'realizo-sandbox' ||
      sandbox?.vars?.REALIZO_ENV !== 'sandbox' ||
      sandbox?.vars?.PAYPAL_MODE !== 'sandbox' ||
      sandbox?.vars?.MUAPI_GENERATION_ENABLED !== 'false' ||
      sandbox?.vars?.REALIZO_WALLET_ONLY !== 'true' ||
      !db || db.database_name !== SANDBOX_NAME) {
    throw new Error('Configuración de Sandbox incorrecta: operación detenida.');
  }
  if (typeof db.database_id !== 'string' || !UUID.test(db.database_id)) {
    throw new Error('El identificador de D1 no es un UUID válido.');
  }
  if (primaryIds.includes(db.database_id.toLowerCase())) {
    throw new Error('BLOQUEADO: D1 Sandbox coincide con la original.');
  }
  if (existing) {
    if (existing.name !== SANDBOX_NAME || !UUID.test(existing.uuid || '') ||
        primaryIds.includes(existing.uuid.toLowerCase())) {
      throw new Error('La D1 remota no corresponde a una base Sandbox segura.');
    }
    if (db.database_id.toLowerCase() !== existing.uuid.toLowerCase()) {
      throw new Error('La D1 Sandbox ya existe pero su UUID no está confirmado en GitHub. Revisión manual requerida.');
    }
    return { action: 'reuse', uuid: existing.uuid };
  }
  if (db.database_id !== PLACEHOLDER) {
    throw new Error('El UUID ya está configurado pero la D1 Sandbox no existe en esta cuenta.');
  }
  return { action: 'create' };
}

async function cloudflare(path, { method = 'GET', body } = {}) {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: token } = process.env;
  if (!/^[0-9a-f]{32}$/i.test(accountId || '') || !token) {
    throw new Error('Faltan el token o la cuenta Cloudflare para Sandbox.');
  }
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + path;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    // Do not print arbitrary API errors: they could contain request metadata.
    throw new Error('Cloudflare no autorizó la operación D1 (HTTP ' + response.status + ').');
  }
  return data.result;
}

export async function provisionSandbox() {
  const sandbox = JSON.parse(readFileSync('wrangler.sandbox.jsonc', 'utf8'));
  const original = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  // The remote lookup is read-only; both create/reuse paths are checked below.
  const found = await cloudflare('/d1/database?name=' + SANDBOX_NAME + '&per_page=10');
  if (!Array.isArray(found)) throw new Error('Respuesta D1 inesperada.');
  const matches = found.filter(db => db.name === SANDBOX_NAME);
  if (matches.length > 1) throw new Error('Varias bases Sandbox con el mismo nombre: revisión manual.');
  const plan = planSandboxD1({ sandbox, original, existing: matches[0] || null });
  if (plan.action === 'reuse') {
    process.stdout.write('D1 Sandbox ya configurada, sin modificar la base.\n');
    return;
  }
  const created = await cloudflare('/d1/database', {
    method: 'POST', body: { name: SANDBOX_NAME },
  });
  if (created?.name !== SANDBOX_NAME || !UUID.test(created?.uuid || '') ||
      original.d1_databases.some(db => db.database_id?.toLowerCase() === created.uuid.toLowerCase())) {
    throw new Error('Respuesta de creación D1 insegura; detener antes de migraciones.');
  }
  sandbox.d1_databases.find(db => db.binding === 'WALLETS_DB').database_id = created.uuid;
  writeFileSync('wrangler.sandbox.jsonc', JSON.stringify(sandbox, null, 2) + '\n');
  process.stdout.write('Nueva D1 exclusiva creada y UUID escrito en configuración Sandbox.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await provisionSandbox();
  } catch (error) {
    process.stderr.write('SEGURIDAD D1: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
