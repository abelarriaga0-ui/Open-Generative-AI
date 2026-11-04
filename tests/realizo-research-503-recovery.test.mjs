import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchPremiumResearch,reconcileExpiredPremiumLaunch} from '../lib/realizo-creative/research-lifecycle.js';

function database({status='researching',error_code=null,updated_at='2026-11-04 02:49:00'}={}){
 const row={id:'project-1',user_id:'user-1',status,error_code,
   updated_at,provider_response_id:null};
 const order={status:'reserved'};
 const db={
  prepare(sql){
   return {bind(...args){
    return {
     async first(){
      if(sql.includes('FROM realizo_ai_projects'))return {...row};
      return null;
     },
     async run(){
      if(sql.includes('SET provider_response_id=?')){
       if(row.status==='researching'&&!row.provider_response_id)row.provider_response_id=args[0];
      }else if(sql.includes('SET status=?,error_code=?')){
       if(row.status==='researching'&&!row.provider_response_id){
        row.status=args[0];row.error_code=args[1];
        row.updated_at='2026-11-04 02:51:00';
       }
      }else if(sql.includes("SET status='failed'")){
       if((row.status==='researching'||(row.status==='needs_review'&&row.error_code==='research_launch_unconfirmed'))&&!row.provider_response_id){
        row.status='failed';row.error_code='research_launch_unconfirmed';
       }
      }else if(sql.includes("SET status='released'")){
       if(sql.includes('EXISTS')&&row.status!=='failed')return {meta:{changes:0}};
       if(order.status==='reserved')order.status='released';
      }
      return {meta:{changes:1}};
     }
    };
   }};
  },
  async batch(ops){return Promise.all(ops.map(op=>op.run()));}
 };
 return {db,row,order};
}

test('successful OpenAI response is registered on the same research and only one provider POST',async()=>{
 const {db,row,order}=database();
 let calls=0;
 await launchPremiumResearch({WALLETS_DB:db},{
  userId:'user-1',projectId:'project-1',expiresAt:1730000000,
 },async()=>{calls++;return {id:'resp_1234567890',status:'queued'}});
 assert.equal(calls,1);
 assert.equal(row.provider_response_id,'resp_1234567890');
 assert.equal(row.status,'researching');
 assert.equal(order.status,'reserved','capture occurs only after 3 valid concepts');
});

test('definite provider rejection releases research reservation exactly once',async()=>{
 const {db,row,order}=database();
 await launchPremiumResearch({WALLETS_DB:db},{
  userId:'user-1',projectId:'project-1',expiresAt:1730000000,
 },async()=>{throw Error('openai_start_rejected_quota')});
 assert.equal(row.status,'failed');
 assert.equal(row.error_code,'openai_rejected_quota');
 assert.equal(order.status,'released');
});

test('ambiguous OpenAI startup never retries and refunds after the stale grace period',async()=>{
 const {db,row,order}=database();
 let count=0;
 await launchPremiumResearch({WALLETS_DB:db},{
  userId:'user-1',projectId:'project-1',expiresAt:1730000000,
 },async()=>{count++;throw Error('upstream_timeout')});
 assert.equal(count,1);
 assert.equal(row.status,'needs_review');
 assert.equal(row.error_code,'research_launch_unconfirmed');
 assert.equal(order.status,'reserved','do not claim definitive rejection until safety window elapses');
 await reconcileExpiredPremiumLaunch(db,{...row,updated_at:'2026-11-04 02:49:00'},
  {now:Date.parse('2026-11-04T02:55:00Z')});
 assert.equal(row.status,'failed');
 assert.equal(order.status,'released','customer is refunded when no research is delivered');
});

test('the exact 503 orphan: researching, no provider ID and 49 cents reserved is fully refunded once',async()=>{
 const {db,row,order}=database();
 await reconcileExpiredPremiumLaunch(db,{...row},{now:Date.parse('2026-11-04T02:55:00Z')});
 assert.equal(row.status,'failed');
 assert.equal(row.error_code,'research_launch_unconfirmed');
 assert.equal(order.status,'released');
 await reconcileExpiredPremiumLaunch(db,{...row},{now:Date.parse('2026-11-04T02:56:00Z')});
 assert.equal(order.status,'released');
});

test('research with confirmed OpenAI response ID is never marked as orphaned',async()=>{
 const {db,row,order}=database();
 row.provider_response_id='resp_existing12345';
 const output=await reconcileExpiredPremiumLaunch(db,{...row},{now:Date.parse('2026-11-04T03:05:00Z')});
 assert.equal(output.status,'researching');
 assert.equal(order.status,'reserved');
});

test('premium POST never awaits the provider, uses waitUntil and recovers identical idempotency key',()=>{
 const post=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const get=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(post,/ctx\.waitUntil\(task\)/);
 assert.doesNotMatch(post,/await startOpenAIResearch\(/);
 assert.match(post,/reconcileExpiredPremiumLaunch\(db,existing\)/);
 assert.match(post,/request_key/);
 assert.match(get,/reconcileExpiredPremiumLaunch\(db,project\)/);
 assert.match(ui,/recoverStartedResearch/);
 assert.match(ui,/request_key=\x27\+encodeURIComponent\(requestKey\)/);
 assert.match(ui,/No se pudo confirmar el inicio/);
});
