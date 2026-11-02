import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paypalBaseUrl,confirmedCapture} from '../lib/wallet/paypal.js';

test('Live PayPal host only on explicitly enabled production deployment',()=>{
 const good={REALIZO_ENV:'production',PAYPAL_MODE:'live',REALIZO_LIVE_PAYMENTS_ENABLED:'true'};
 assert.equal(paypalBaseUrl(good),'https://api-m.paypal.com');
 assert.throws(()=>paypalBaseUrl({...good,REALIZO_ENV:'sandbox'}),/PayPal Live requiere/);
 assert.throws(()=>paypalBaseUrl({...good,REALIZO_LIVE_PAYMENTS_ENABLED:'false'}),/PayPal Live requiere/);
 assert.equal(paypalBaseUrl({PAYPAL_MODE:'sandbox'}),'https://api-m.sandbox.paypal.com');
});
test('A visible wallet checkout requires real merchant configuration, not fake deposits',()=>{
 const wallet=readFileSync('app/api/wallet/route.js','utf8');
 assert.match(wallet,/provider_environment='live'/);
 assert.match(wallet,/env.PAYPAL_MODE==='live'/);
 assert.match(wallet,/REALIZO_LIVE_PAYMENTS_ENABLED==='true'/);
 assert.doesNotMatch(wallet,/checkout_enabled:.*=== 'sandbox'/);
});
test('Only matching completed USD order with a completed capture can fund wallet',()=>{
 const id='7a87e880-1c56-44ce-b137-9fd97e5bdc5d';
 const intent={id,paypal_order_id:'TESTORDER1234',amount_cents:2000};
 const order={id:intent.paypal_order_id,status:'COMPLETED',
  purchase_units:[{custom_id:id,amount:{currency_code:'USD',value:'20.00'},
  payments:{captures:[{id:'CAPTURE1234',status:'COMPLETED',amount:{currency_code:'USD',value:'20.00'}}]}}]};
 assert.equal(confirmedCapture(order,intent)?.id,'CAPTURE1234');
 assert.equal(confirmedCapture({...order,status:'APPROVED'},intent),null);
 assert.equal(confirmedCapture({...order,purchase_units:[{...order.purchase_units[0],amount:{currency_code:'USD',value:'19.99'}}]},intent),null);
 assert.equal(confirmedCapture({...order,purchase_units:[{...order.purchase_units[0],payments:{captures:[{...order.purchase_units[0].payments.captures[0],status:'PENDING'}]}}]},intent),null);
});
test('Sandbox paid generation remains disabled and no production key is committed',()=>{
 const flags=JSON.parse(readFileSync('wrangler.auth-sandbox.jsonc','utf8')).vars;
 assert.equal(flags.MUAPI_GENERATION_ENABLED,'false');
 assert.equal(flags.REALIZO_MUAPI_PILOT,'false');
 assert.equal(flags.PAYPAL_MODE,'sandbox');
 const production=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 assert.equal(production.vars?.PAYPAL_CLIENT_SECRET,undefined);
 assert.equal(production.vars?.MUAPI_API_KEY,undefined);
});
