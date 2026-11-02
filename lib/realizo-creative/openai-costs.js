// A provider usage estimate, NOT an invoice or an exact customer charge.
// Pricing snapshot: https://platform.openai.com/pricing (Standard, October 2026).
// Reconcile estimates with OpenAI Organization Costs / monthly invoice exports.
export const OPENAI_COST_SNAPSHOT='2026-10-30-standard';
const PRICE_PER_MILLION={
 'gpt-6-luna':{input:0.05,cached:0.005,output:0.25},
};
export const WEB_SEARCH_USD_PER_CALL=0.01;
export function estimateOpenAIResearchCost({model,usage,webCalls}={}){
 const rates=PRICE_PER_MILLION[String(model||'').toLowerCase()];
 const input=Number(usage?.input_tokens);
 const output=Number(usage?.output_tokens);
 const cached=Number(usage?.input_tokens_details?.cached_tokens??0);
 const calls=Number(webCalls);
 if(!rates || ![input,output,cached,calls].every(v=>Number.isSafeInteger(v)&&v>=0)
    || cached>input || calls>5) {
  return {status:'unavailable',microUsd:null,pricingSnapshot:OPENAI_COST_SNAPSHOT};
 }
 // micro-USD/token equals the USD-per-million-token rate.
 const microUsd=Math.round((input-cached)*rates.input+cached*rates.cached+
  output*rates.output+calls*WEB_SEARCH_USD_PER_CALL*1_000_000);
 return {status:'estimated',microUsd,pricingSnapshot:OPENAI_COST_SNAPSHOT,
  inputTokens:input,cachedInputTokens:cached,outputTokens:output,webCalls:calls};
}
