import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('editor general uses in-page confirmation instead of native browser popup',()=>{
 const client=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(client,/confirmRealizoChargeInline/);
 assert.doesNotMatch(client,/window\.confirm\(/);
 assert.match(client,/max_price_cents:quote.price_cents/);
 assert.match(client,/role','region'/);
});
test('template and quoted-price UI do not expose infrastructure brand',()=>{
 const template=readFileSync('components/RealizoTemplateCreator.jsx','utf8');
 const wallet=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
 assert.doesNotMatch(template,/['`][^'`]*Muapi[^'`]*['`]/);
 assert.doesNotMatch(wallet,/throw new Error\([^\n]*Muapi/);
 assert.doesNotMatch(quote,/note:[^\n]*Muapi/);
});
