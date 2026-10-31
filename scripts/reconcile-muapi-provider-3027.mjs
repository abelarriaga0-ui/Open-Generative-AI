// One-time real-backed Realizo credit: USD 0.27 + USD 30.00 = USD 30.27.
const ACCOUNT='7e405c54c1a91abbdad537f7fec379a1',D1='2561f6c8-bfb2-4ea4-8527-7fec29188edf',e=process.env;
if(e.REALIZO_ENV!=='sandbox'||e.PAYPAL_MODE!=='sandbox'||e.REALIZO_AUTH_PROVIDER!=='native'||
e.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT||e.REALIZO_D1_SANDBOX!==D1||
!e.REALIZO_MUAPI_API_KEY||!e.CLOUDFLARE_API_TOKEN)throw Error('Sandbox identity mismatch or missing secret');
const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+D1+'/query';
async function sql(statement,params=[]){
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+e.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql:statement,params}),signal:AbortSignal.timeout(18000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||!j.success||j.result?.[0]?.success!==true)throw Error('D1 query failed HTTP '+r.status);
 return j.result[0].results||[];
}
const existing=await sql('SELECT user_id,credited_cents,wallet_before_cents FROM realizo_muapi_provider_balance_reconciliations WHERE slot=1');
if(existing.length>1)throw Error('Duplicate receipts');
if(existing.length===1){
 const row=existing[0];
 const wallet=await sql('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?',[row.user_id]);
 const ledger=await sql("SELECT available_delta_cents,reserved_delta_cents FROM wallet_ledger WHERE user_id=? AND external_reference='muapi-provider-reconciled:30.27:1'",[row.user_id]);
 if(Number(row.credited_cents)!==3000||Number(row.wallet_before_cents)!==27||wallet.length!==1||
   ledger.length!==1||Number(ledger[0].available_delta_cents)!==3000||
   Number(ledger[0].reserved_delta_cents)!==0)throw Error('Existing receipt inconsistent');
 console.log('MUAPI_3027_RECONCILIATION=ALREADY_APPLIED_AND_VERIFIED; no duplicate credit');
 process.exit(0);
}
const owner=await sql("SELECT i.user_id,w.available_cents AS available,w.reserved_cents AS reserved FROM realizo_prepaid_muapi_imports i JOIN wallets w ON w.user_id=i.user_id JOIN wallet_users u ON u.id=i.user_id WHERE i.slot=1 AND i.amount_cents=775 AND u.auth_provider='realizo'");
if(owner.length!==1||Number(owner[0].available)!==27||Number(owner[0].reserved)!==0)
 throw Error('Owner wallet changed from USD 0.27; no credit');
const liabilities=await sql('SELECT COALESCE(SUM(available_cents+reserved_cents),0) AS cents FROM wallets');
if(liabilities.length!==1||Number(liabilities[0].cents)!==27)
 throw Error('Other wallet balances detected');
if((await sql("SELECT id FROM generation_jobs WHERE status IN ('reserved','submitted','unknown') LIMIT 1")).length)
 throw Error('Generation pending');
if((await sql("SELECT id FROM verified_deposits LIMIT 1")).length)
 throw Error('PayPal deposit must be reconciled separately');
const r=await fetch('https://api.muapi.ai/api/v1/account/balance',{
 headers:{'x-api-key':e.REALIZO_MUAPI_API_KEY},signal:AbortSignal.timeout(18000)});
if(!r.ok)throw Error('Muapi live verification failed HTTP '+r.status);
const json=await r.json(),cents=Math.round(Number(json.balance)*100);
if(!Number.isSafeInteger(cents)||cents<3027)
 throw Error('Provider balance lower than USD 30.27, no wallet credit');
console.log('VERIFIED_PROVIDER_BALANCE_USD='+(cents/100).toFixed(2));
console.log('OWNER_BEFORE_USD=0.27; NEW_CREDIT_USD=30.00');
await sql('INSERT OR IGNORE INTO realizo_muapi_provider_balance_reconciliations(slot,user_id,credited_cents,provider_verified_cents,wallet_before_cents) VALUES(1,?,?,?,?)',[owner[0].user_id,3000,cents,27]);
const after=await sql('SELECT available_cents,reserved_cents FROM wallets WHERE user_id=?',[owner[0].user_id]);
const receipt=await sql('SELECT user_id,credited_cents FROM realizo_muapi_provider_balance_reconciliations WHERE slot=1');
const ledger=await sql("SELECT user_id,kind,available_delta_cents,reserved_delta_cents FROM wallet_ledger WHERE external_reference='muapi-provider-reconciled:30.27:1'");
if(after.length!==1||Number(after[0].available_cents)!==3027||Number(after[0].reserved_cents)!==0||
receipt.length!==1||receipt[0].user_id!==owner[0].user_id||Number(receipt[0].credited_cents)!==3000||
ledger.length!==1||ledger[0].user_id!==owner[0].user_id||ledger[0].kind!=='deposit'||
Number(ledger[0].available_delta_cents)!==3000||Number(ledger[0].reserved_delta_cents)!==0)
 throw Error('Wallet reconciliation cannot be verified; manual review required');
console.log('MUAPI_3027_RECONCILIATION=SUCCESS; owner wallet USD 30.27 backed by live Muapi');
console.log('No PayPal, provider spending, video generation or production access');
