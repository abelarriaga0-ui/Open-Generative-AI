import {test} from 'node:test';
import assert from 'node:assert/strict';
import {settlePaypalOrder} from '../lib/wallet/paypal.js';

const confirmed={
  id:'ORDER-123',status:'COMPLETED',
  purchase_units:[{custom_id:'intent-a',
    amount:{currency_code:'USD',value:'20.00'},
    payments:{captures:[{id:'CAPTURE-123',status:'COMPLETED',
      amount:{currency_code:'USD',value:'20.00'}}]}}]
};
const intent={id:'intent-a',user_id:'wallet-a',paypal_order_id:'ORDER-123',amount_cents:2000,status:'created'};
function db(existingDeposit){
  const state={updated:false,deposit:existingDeposit,inserted:false};
  const mock={prepare(sql){
    return {bind(...args){
      return {
        first:async()=>{
          if(sql.includes('FROM paypal_topup_orders'))return intent;
          if(sql.includes('FROM verified_deposits'))return state.deposit;
          throw Error('unexpected read');
        },
        run:async()=>{
          if(sql.includes('INSERT OR IGNORE INTO verified_deposits')){
            if(!state.deposit){
              state.deposit={user_id:'wallet-a',amount_cents:2000};
              state.inserted=true;
            }
            return {meta:{changes:state.inserted?1:0}};
          }
          if(sql.includes('UPDATE paypal_topup_orders')){state.updated=true;return{meta:{changes:1}};}
          throw Error('unexpected write');
        }
      };
    }};
  }};
  return {mock,state};
}
test('verified capture credited exactly once to matching user',async()=>{
  const {mock,state}=db(null);
  assert.deepEqual(await settlePaypalOrder(mock,'ORDER-123',confirmed),{status:'paid'});
  assert.equal(state.inserted,true);
  assert.equal(state.updated,true);
});
test('colliding capture on another user never falsely marks order paid',async()=>{
  const {mock,state}=db({user_id:'wallet-b',amount_cents:2000});
  await assert.rejects(settlePaypalOrder(mock,'ORDER-123',confirmed),/paypal_capture_collision_manual_review/);
  assert.equal(state.updated,false);
});
test('colliding capture with different amount never marks order paid',async()=>{
  const {mock,state}=db({user_id:'wallet-a',amount_cents:1});
  await assert.rejects(settlePaypalOrder(mock,'ORDER-123',confirmed),/paypal_capture_collision_manual_review/);
  assert.equal(state.updated,false);
});
