// Fail closed before ANY remote D1 operation or sandbox Worker upload.
 // The old and sandbox Workers MUST NOT share the same D1 database.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkSandboxIsolation(sandbox, original) {
  if (sandbox?.name !== 'realizo-sandbox' || sandbox.name === original?.name) {
    throw new Error('El Worker Sandbox debe estar separado del Worker original.');
  }
  const flags = sandbox.vars || {};
  if (flags.REALIZO_ENV !== 'sandbox' ||
      flags.REALIZO_WALLET_ONLY !== 'true' ||
      flags.PAYPAL_MODE !== 'sandbox' ||
      flags.MUAPI_GENERATION_ENABLED !== 'false') {
    throw new Error('Configuración insegura: Sandbox debe bloquear pagos y generaciones reales.');
  }
  const db = sandbox.d1_databases?.find(item => item.binding === 'WALLETS_DB');
  if (!db || db.database_name !== 'realizo-wallets-sandbox') {
    throw new Error('Configura una base D1 exclusiva llamada realizo-wallets-sandbox.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(db.database_id || '') ||
      /^0+$/.test(db.database_id.replace(/-/g, ''))) {
    throw new Error('Crea realizo-wallets-sandbox en Cloudflare y reemplaza el UUID pendiente.');
  }
  if ((original?.d1_databases || []).some(item =>
    item.database_id?.toLowerCase() === db.database_id.toLowerCase() ||
    item.database_name === db.database_name)) {
    throw new Error('BLOQUEADO: Sandbox comparte base de datos con el Worker original.');
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const sandbox = JSON.parse(readFileSync('wrangler.sandbox.jsonc', 'utf8'));
    const original = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
    checkSandboxIsolation(sandbox, original);
    process.stdout.write('OK: Worker y D1 Sandbox aislados.\n');
  } catch (error) {
    process.stderr.write('SEGURIDAD: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
