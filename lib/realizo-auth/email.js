import { assertOwnAuthConfig, canonicalEmail, hmacHex, nowSeconds } from './crypto.js';
const OTP_LIFETIME=10*60;
// Each UPSERT is atomic; replacing an OTP cannot reset these quotas.
export async function claimOtpQuota(db,scope,subjectHash,stamp,limit) {
  const windowStart=Math.floor(stamp/3600)*3600;
  const result=await db.prepare(
    'INSERT INTO realizo_auth_rate_buckets(scope,subject_hash,window_start,attempts) VALUES(?,?,?,1) '+
    'ON CONFLICT(scope,subject_hash,window_start) DO UPDATE SET attempts=attempts+1 WHERE attempts<?'
  ).bind(scope,subjectHash,windowStart,limit).run();
  return result.meta?.changes===1;
}
export function emailEnabled(env) {
  return Boolean(env.REALIZO_EMAIL_FROM && env.RESEND_API_KEY && env.REALIZO_AUTH_PEPPER);
}
export async function requestEmailCode(env, rawEmail, ip) {
  assertOwnAuthConfig(env);
  if (!emailEnabled(env)) throw new Error('realizo_email_not_configured');
  const email = canonicalEmail(rawEmail);
  if (!email) return { ok: false, error: 'invalid_email' };
  const stamp = nowSeconds();
  const ipHash = await hmacHex(env.REALIZO_AUTH_PEPPER,'ip:'+String(ip||'unknown'));
  const emailHash=await hmacHex(env.REALIZO_AUTH_PEPPER,'rate:email:'+email);
  if(!await claimOtpQuota(env.WALLETS_DB,'send-ip',ipHash,stamp,12) ||
     !await claimOtpQuota(env.WALLETS_DB,'send-email',emailHash,stamp,5))
    return {ok:true,throttled:true};
  const previous = await env.WALLETS_DB.prepare('SELECT sent_at FROM realizo_email_challenges WHERE email=?')
    .bind(email).first();
  if (previous && previous.sent_at > stamp-60) return {ok:true,throttled:true};
  const bytes = crypto.getRandomValues(new Uint32Array(1))[0];
  const code = String(bytes % 100000000).padStart(8,'0');
  const hashed = await hmacHex(env.REALIZO_AUTH_PEPPER,'email:'+email+':'+code);
  const result = await env.WALLETS_DB.prepare(
    `INSERT INTO realizo_email_challenges
     (email,code_hash,expires_at,attempts,sent_at,ip_hash,consumed_at)
     VALUES (?,?,?,0,?,?,NULL)
     ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,
       expires_at=excluded.expires_at,attempts=0,sent_at=excluded.sent_at,
       ip_hash=excluded.ip_hash,consumed_at=NULL
     WHERE realizo_email_challenges.sent_at<=?`
  ).bind(email,hashed,stamp+OTP_LIFETIME,stamp,ipHash,stamp-60).run();
  if(result.meta?.changes!==1) return {ok:true,throttled:true};
  const sent=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({
      from: env.REALIZO_EMAIL_FROM, to:[email],
      subject:'Código de acceso a Realizo',
      text:'Tu código de acceso a Realizo es '+code+'. Caduca en 10 minutos. Si no lo solicitaste, ignora este correo.',
    }),
  });
  if(!sent.ok) {
    await env.WALLETS_DB.prepare('DELETE FROM realizo_email_challenges WHERE email=? AND code_hash=?')
      .bind(email,hashed).run();
    throw new Error('email_provider_unavailable');
  }
  return {ok:true};
}
export async function verifyEmailCode(env, rawEmail, submitted, ip) {
  assertOwnAuthConfig(env);
  const email=canonicalEmail(rawEmail);
  if(!email || typeof submitted!=='string' || !/^\d{8}$/.test(submitted)) return null;
  const stamp=nowSeconds();
  const ipHash=await hmacHex(env.REALIZO_AUTH_PEPPER,'ip:'+String(ip||'unknown'));
  const emailHash=await hmacHex(env.REALIZO_AUTH_PEPPER,'rate:email:'+email);
  if(!await claimOtpQuota(env.WALLETS_DB,'verify-ip',ipHash,stamp,60) ||
     !await claimOtpQuota(env.WALLETS_DB,'verify-email',emailHash,stamp,20)) return null;
  const expected=await hmacHex(env.REALIZO_AUTH_PEPPER,'email:'+email+':'+submitted);
  const result=await env.WALLETS_DB.prepare(
    `UPDATE realizo_email_challenges SET consumed_at=?,attempts=attempts+1
     WHERE email=? AND code_hash=? AND consumed_at IS NULL AND attempts<5 AND expires_at>?`
  ).bind(stamp,email,expected,stamp).run();
  if(result.meta?.changes===1) return email;
  await env.WALLETS_DB.prepare(
    'UPDATE realizo_email_challenges SET attempts=attempts+1 WHERE email=? AND consumed_at IS NULL AND attempts<5'
  ).bind(email).run();
  return null;
}
