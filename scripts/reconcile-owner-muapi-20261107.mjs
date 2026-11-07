// Privileged GitHub Actions entrypoint: one-time verified owner allocation.
// NEVER exposed as a public HTTP endpoint. Does not call Muapi generation or PayPal.
const CHECK_ONLY=process.argv.includes('--check');
const APPLY=process.argv.includes('--apply');
if(CHECK_ONLY===APPLY)throw Error('Select exactly one of --check or --apply');
const token=process.env.CLOUDFLARE_API_TOKEN;
const apiKey=process.env.REALIZO_MUAPI_API_KEY;
if(!token||!apiKey)throw Error('Protected credentials unavailable');
const accountId='7e405c54c1a91abbdad537f7fec379a1';
const dbId='2561f6c8-bfb2-4ea4-8527-7fec29188edf';
const api='https://api.cloudflare.com/client/v4/accounts/'+accountId+'/d1/database/'+dbId+'/query';
const S={provider:30892,before:34,after:3089,credit:3055};

async function sql(statement){
  const response=await fetch(api,{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({sql:statement}),signal:AbortSignal.timeout(18000)});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||!json.success||!json.result?.[0]?.success)
    throw Error('Cloudflare D1 verification or atomic write failed; HTTP '+response.status);
  return {rows:json.result[0].results||[],changes:Number(json.result[0].meta?.changes||0)};
}
async function providerBalance(){
  const response=await fetch('https://api.muapi.ai/api/v1/account/balance',{
    headers:{'x-api-key':apiKey},signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error('Muapi provider balance unverified HTTP '+response.status);
  const info=await response.json().catch(()=>({}));
  const raw=String(info.balance??'');
  if(!/^\d{1,9}(?:\.\d{1,3})?$/.test(raw))throw Error('Muapi balance precision unsupported');
  const [w,f='']=raw.split('.');
  const mills=Number(w)*1000+Number(f.padEnd(3,'0'));
  if(mills!==S.provider)throw Error('Muapi balance changed since independent audit; do NOT sync');
  if(Math.floor(mills/10)!==S.after)throw Error('Cannot represent provider balance safely in cents');
  return mills;
}
async function preflight(){
  const provider=await providerBalance();
  const original=await sql("SELECT i.user_id,w.available_cents AS available,w.reserved_cents AS reserved "+
    "FROM realizo_prepaid_muapi_imports i "+
    "JOIN realizo_muapi_provider_balance_reconciliations r ON r.user_id=i.user_id AND r.slot=1 AND r.credited_cents=3000 "+
    "JOIN wallet_users u ON u.id=i.user_id AND u.auth_provider='realizo' "+
    "JOIN realizo_accounts a ON a.id=u.auth_subject "+
    "JOIN wallets w ON w.user_id=i.user_id WHERE i.slot=1 AND i.amount_cents=775");
  if(original.rows.length!==1)throw Error('Unique historical owner not confirmed');
  const owner=original.rows[0];
  if(!/^[0-9a-f-]{36}$/i.test(owner.user_id))throw Error('Owner identity not a UUID');
  const id=owner.user_id;
  const check=await sql("SELECT "+
    "(SELECT COUNT(*) FROM wallets WHERE user_id<>'"+id+"' AND (available_cents>0 OR reserved_cents>0)) AS others, "+
    "(SELECT COUNT(*) FROM generation_jobs WHERE status IN ('reserved','submitted','unknown')) AS pending_jobs, "+
    "(SELECT COUNT(*) FROM realizo_ai_premium_orders WHERE status='reserved') AS pending_ai, "+
    "(SELECT COUNT(*) FROM verified_deposits WHERE user_id<>'"+id+"' AND provider_environment='live') AS other_live, "+
    "(SELECT COUNT(*) FROM verified_deposits WHERE user_id='"+id+"' AND provider_environment='live') AS owner_live");
  const counts=check.rows[0];
  if(!counts||[counts.others,counts.pending_jobs,counts.pending_ai,counts.other_live].some(n=>Number(n)!==0))
    throw Error('Other liabilities, outstanding jobs or receipts block sync');
  if(Number(counts.owner_live)!==1)
    throw Error('Owner PayPal Live reconciliation unexpectedly changed');
  console.log('REALIZO_MUAPI_PROVIDER_VERIFIED_USD='+(provider/1000).toFixed(3));
  console.log('REALIZO_OTHER_WALLET_LIABILITIES_ZERO=true');
  console.log('REALIZO_OUTSTANDING_JOBS_ZERO=true');
  console.log('REALIZO_LIVE_PAYMENT_OWNER_ONLY=true');
  return owner;
}
const owner=await preflight();
const existing=APPLY?await sql("SELECT slot,user_id,after_cents,allocated_cents,provider_verified_mills "+
  "FROM realizo_owner_muapi_balance_sync_20261107 WHERE slot=1"):null;
if(existing?.rows.length){
  const row=existing.rows[0];
  if(row.user_id!==owner.user_id||Number(row.after_cents)!==S.after||
     Number(row.allocated_cents)!==S.credit||Number(row.provider_verified_mills)!==S.provider)
    throw Error('Previous sync receipt differs; manual audit required');
  if(Number(owner.available)!==S.after||Number(owner.reserved)!==0)
    throw Error('Prior receipt exists but current funds moved; no automatic repeat');
  console.log('REALIZO_OWNER_SYNC_ALREADY_APPLIED=true; no second credit');
  process.exit(0);
}
if(Number(owner.available)!==S.before||Number(owner.reserved)!==0)
  throw Error('Owner wallet changed since audit; not modifying funds');
if(CHECK_ONLY){
  console.log('REALIZO_OWNER_SYNC_PREFLIGHT=PASS, READ_ONLY');
  console.log('EXPECTED_OWNER_WALLET_USD='+(S.after/100).toFixed(2));
  process.exit(0);
}
// Single D1 INSERT invokes two guarded SQL triggers within one SQLite transaction.
// The owner id comes exclusively from authenticated D1 reconciliation records.
const insert="INSERT INTO realizo_owner_muapi_balance_sync_20261107 "+
  "(slot,user_id,before_cents,after_cents,allocated_cents,provider_verified_mills) "+
  "VALUES(1,'"+owner.user_id+"',"+S.before+","+S.after+","+S.credit+","+S.provider+")";
await sql(insert);
const receipt=await sql("SELECT s.after_cents,s.allocated_cents,w.available_cents,w.reserved_cents,l.available_delta_cents "+
  "FROM realizo_owner_muapi_balance_sync_20261107 s "+
  "JOIN wallets w ON w.user_id=s.user_id "+
  "JOIN wallet_ledger l ON l.user_id=s.user_id "+
  "AND l.external_reference='verified-direct-muapi-prepaid-owner-sync:20261107:1' WHERE s.slot=1");
const row=receipt.rows[0];
if(receipt.rows.length!==1||Number(row.after_cents)!==S.after||Number(row.available_cents)!==S.after||
   Number(row.reserved_cents)!==0||Number(row.allocated_cents)!==S.credit||
   Number(row.available_delta_cents)!==S.credit)
  throw Error('Credit outcome requires manual reconciliation; NEVER automatically repeat');
console.log('OWNER_WALLET_AVAILABLE_AFTER_USD='+(Number(row.available_cents)/100).toFixed(2));
console.log('OWNER_ADJUSTMENT_RECORDED_USD='+(Number(row.allocated_cents)/100).toFixed(2));
console.log('PROVIDER_REMAINING_MILLIDOLLARS_UNALLOCATED=2');
console.log('REALIZO_OWNER_SYNC=SUCCESS; exactly one ledger-backed deposit; no PayPal charge, Muapi generation or other wallet writes');
