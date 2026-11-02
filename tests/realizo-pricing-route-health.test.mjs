import test from 'node:test';
import assert from 'node:assert/strict';
import {walletPilotAction} from '../lib/wallet/request-policy.js';
test('Sandbox pricing diagnostic passes pilot proxy while arbitrary API stays denied',()=>{
 assert.equal(walletPilotAction('/api/realizo/pricing/health',true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/pricing/arbitrary',true,true),'deny');
 assert.equal(walletPilotAction('/api/wallet/quote',true,true),'allow');
 assert.equal(walletPilotAction('/api/wallet/generate',true,true),'allow');
});
