import { canonicalEmail } from './crypto.js';
export async function findOrCreateAccount(db, rawEmail, provider, subject) {
  const email = canonicalEmail(rawEmail);
  if (!email || !['email','google'].includes(provider) || typeof subject !== 'string' || !subject)
    throw new Error('invalid_verified_identity');
  const existing = await db.prepare(
    'SELECT account_id FROM realizo_identities WHERE provider=? AND provider_subject=?'
  ).bind(provider, subject).first();
  if (existing) {
    const account = await db.prepare('SELECT id,email FROM realizo_accounts WHERE id=?')
      .bind(existing.account_id).first();
    if (!account || account.email !== email) throw new Error('identity_link_mismatch');
    return account;
  }
  // Only the backend calls this after verifying email OTP or Google's OIDC signature.
  const proposedId = crypto.randomUUID();
  await db.prepare('INSERT OR IGNORE INTO realizo_accounts (id,email) VALUES (?,?)')
    .bind(proposedId, email).run();
  const account = await db.prepare('SELECT id,email FROM realizo_accounts WHERE email=?')
    .bind(email).first();
  if (!account) throw new Error('account_creation_failed');
  await db.prepare('INSERT OR IGNORE INTO realizo_identities (provider,provider_subject,account_id) VALUES (?,?,?)')
    .bind(provider,subject,account.id).run();
  const linked = await db.prepare('SELECT account_id FROM realizo_identities WHERE provider=? AND provider_subject=?')
    .bind(provider,subject).first();
  if (linked?.account_id !== account.id) throw new Error('identity_link_mismatch');
  return account;
}
