import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('PayPal Sandbox offers secure hosted card fields in Realizo without collecting card details',()=>{
 const wallet=read('components/wallet/PaypalTopup.jsx');
 assert.match(wallet,/components=buttons,card-fields/);
 assert.match(wallet,/window\.paypal\.CardFields/);
 assert.match(wallet,/cardFields\.isEligible\(\)/);
 assert.match(wallet,/cardFields\.NumberField\(\)\.render/);
 assert.match(wallet,/cardFields\.ExpiryField\(\)\.render/);
 assert.match(wallet,/cardFields\.CVVField\(\)\.render/);
 assert.match(wallet,/Pagar con tarjeta dentro de Realizo/);
 assert.match(wallet,/cardInstance|cardsRef\.current/);
 assert.doesNotMatch(wallet,/getElementById\(.*(?:cvv|card-number).*\)\.value/);
 assert.match(wallet,/Reintentar carga de PayPal/);
});
test('order funding is not forced to a PayPal wallet and credits only after capture',()=>{
 const order=read('app/api/wallet/paypal/create-order/route.js');
 const card=read('components/wallet/PaypalTopup.jsx');
 assert.doesNotMatch(order,/payment_source:\s*\{\s*paypal:/);
 assert.match(order,/amount:\s*\{ currency_code: 'USD'/);
 assert.match(order,/paypalRequest\(env, '\/v2\/checkout\/orders'/);
 assert.match(card,/\/api\/wallet\/paypal\/capture-order/);
 const settlement=read('lib/wallet/paypal.js');
 assert.match(settlement,/confirmedCapture\(verifiedPaypalOrder, intent\)/);
 assert.match(settlement,/INSERT OR IGNORE INTO verified_deposits/);
});
test('auto-reload setup checkbox defaults selected and stays editable without creating a payment mandate',()=>{
 const wallet=read('components/wallet/PaypalTopup.jsx');
 assert.match(wallet,/Recarga automática de \$20 al llegar a \$5/);
 assert.match(wallet,/const \[autoTopupPreferred,setAutoTopupPreferred\]=useState\(true\)/);
 assert.match(wallet,/type="checkbox" checked=\{autoTopupPreferred\}/);
 assert.match(wallet,/onChange=\{event=>setAutoTopupPreferred\(event.target.checked\)\}/);
 assert.doesNotMatch(wallet,/type="checkbox" disabled checked=\{false\}/);
 assert.match(wallet,/Actualmente no se ejecutan cargos automáticos/);
 assert.match(wallet,/autorizar por separado un método de pago/);
 assert.doesNotMatch(wallet,/\/api\/wallet\/auto-topup\/charge/);
});
test('checkout stays locked to Sandbox; no accidental live PayPal calls',()=>{
 const paypal=read('lib/wallet/paypal.js');
 const cfg=JSON.parse(read('wrangler.auth-sandbox.jsonc'));
 assert.equal(cfg.vars.PAYPAL_MODE,'sandbox');
 assert.match(paypal,/if \(mode === 'live'\) throw new WalletSetupError/);
});
