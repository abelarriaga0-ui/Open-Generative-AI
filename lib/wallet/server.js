import { getCloudflareContext } from '@opennextjs/cloudflare';
import { verifyAccessUser } from './access-auth.js';
import { getOwnSession } from '../realizo-auth/session.js';
import { WalletSetupError } from './errors.js';

export { WalletSetupError } from './errors.js';

export async function getWalletEnvironment() {
  const { env } = getCloudflareContext();
  if (!env?.WALLETS_DB) throw new WalletSetupError('Falta configurar la base D1 WALLETS_DB.');
  return env;
}

export async function requireWalletUser(request, env) {
  let principal;
  if (env.REALIZO_AUTH_PROVIDER === 'native') {
    const account = await getOwnSession(env);
    principal = account ? { provider: 'realizo', subject: account.id, email: account.email } : null;
  } else {
    if (!env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) {
      throw new WalletSetupError('Falta configurar la autenticación de Cloudflare Access.');
    }
    principal = await verifyAccessUser(request, env);
  }
  if (!principal) return null;
  const db = env.WALLETS_DB;
  const existing = await db.prepare(
    'SELECT id FROM wallet_users WHERE auth_provider=? AND auth_subject=?'
  ).bind(principal.provider, principal.subject).first();
  const candidateId = existing?.id || crypto.randomUUID();
  await db.prepare(
    'INSERT OR IGNORE INTO wallet_users (id,auth_provider,auth_subject,email) VALUES (?,?,?,?)'
  ).bind(candidateId, principal.provider, principal.subject, principal.email).run();
  const row = await db.prepare(
    'SELECT id, email FROM wallet_users WHERE auth_provider=? AND auth_subject=?'
  ).bind(principal.provider, principal.subject).first();
  await db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').bind(row.id).run();
  return { id: row.id, email: row.email };
}

export async function getWallet(db, userId) {
  return await db.prepare(
    'SELECT available_cents, reserved_cents, currency FROM wallets WHERE user_id=?'
  ).bind(userId).first();
}

export async function getWalletActivity(db, userId) {
  return await db.prepare(
    'SELECT kind, available_delta_cents, reserved_delta_cents, created_at FROM wallet_ledger WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 50'
  ).bind(userId).all();
}

export async function getActiveModels(db) {
  return await db.prepare(
    'SELECT model_id, customer_price_cents FROM model_prices WHERE enabled=1 ORDER BY model_id ASC'
  ).all();
}

export async function getPricedModel(db, modelId) {
  return await db.prepare(
    'SELECT model_id, muapi_endpoint, customer_price_cents, allowed_input_keys_json, fixed_options_json FROM model_prices WHERE model_id=? AND enabled=1'
  ).bind(modelId).first();
}

export async function getGenerationJob(db, userId, jobId) {
  return await db.prepare(
    'SELECT id,model_id,status,price_cents,provider_request_id,error_reason,result_json,created_at FROM generation_jobs WHERE id=? AND user_id=?'
  ).bind(jobId, userId).first();
}

export async function createReservedJob(db, { userId, modelId, priceCents, idempotencyKey }) {
  const previous = await db.prepare(
    'SELECT id,model_id,price_cents,status FROM generation_jobs WHERE user_id=? AND idempotency_key=?'
  ).bind(userId, idempotencyKey).first();
  if (previous) {
    if (previous.model_id !== modelId || previous.price_cents !== priceCents) {
      throw new Error('idempotency_key_reused');
    }
    return { ...previous, newlyCreated: false };
  }
  const jobId = crypto.randomUUID();
  try {
    // A D1 trigger reserves the balance atomically or aborts the insertion.
    const result = await db.prepare(
      'INSERT OR IGNORE INTO generation_jobs (id,user_id,model_id,idempotency_key,price_cents) VALUES (?,?,?,?,?)'
    ).bind(jobId, userId, modelId, idempotencyKey, priceCents).run();
    if (result.meta?.changes === 1) return { id: jobId, status: 'reserved', newlyCreated: true };
  } catch (error) {
    if (String(error).includes('wallet_insufficient_funds')) throw new Error('insufficient_funds');
    throw error;
  }
  const raceWinner = await db.prepare(
    'SELECT id,model_id,price_cents,status FROM generation_jobs WHERE user_id=? AND idempotency_key=?'
  ).bind(userId, idempotencyKey).first();
  if (!raceWinner || raceWinner.model_id !== modelId || raceWinner.price_cents !== priceCents) {
    throw new Error('idempotency_key_reused');
  }
  return { ...raceWinner, newlyCreated: false };
}

export async function updateJobStatus(db, userId, jobId, status, providerRequestId = null, reason = null, resultJson = null) {
  if (!['submitted','unknown','completed','failed'].includes(status)) throw new Error('invalid_status');
  await db.prepare(
    `UPDATE generation_jobs SET status=?, provider_request_id=COALESCE(?,provider_request_id),
       error_reason=?, result_json=COALESCE(?,result_json), updated_at=datetime('now')
       WHERE id=? AND user_id=? AND status IN ('reserved','submitted','unknown')`
  ).bind(status, providerRequestId, reason, resultJson, jobId, userId).run();
}

export function jsonError(error) {
  if (error instanceof WalletSetupError) {
    return Response.json({ error: 'wallet_not_configured', message: error.message }, { status: 503 });
  }
  if (['insufficient_funds', 'idempotency_key_reused'].includes(error?.message)) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  // Do not log arbitrary upstream messages: they can contain payloads or credentials.
  console.error('Wallet request failed');
  return Response.json({ error: 'wallet_internal_error' }, { status: 500 });
}
