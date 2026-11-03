// NMF: hook -> recognizable friction/desire -> product -> use/benefit -> CTA.
// Audio density is a planning target, never a promise of native provider speech.
// No new model/API call and no newly invented product effects.
import {selectedStyle} from './format-guides.js';
const txt=v=>String(v||'').replace(/\s+/g,' ').trim();
export const speechWords=v=>txt(v).split(/\s+/).filter(Boolean).length;
export const MAX_SPOKEN_SCRIPT_CHARACTERS=3200;
export function voiceBudget(seconds,style='ugc'){
 const t=Math.max(1,Math.min(120,Number(seconds)||8));
 const rates={
  ugc:[2.5,3.1],cinematic:[1.75,2.34],
  premium:[1.65,2.22],demo:[2.35,2.95],
 };
 const [minRate,maxRate]=rates[style]||rates.ugc;
 return {
  minimum:Math.max(4,Math.floor(t*minRate)),
  target:Math.max(5,Math.round(t*(minRate+maxRate)/2)),
  maximum:Math.max(7,Math.floor(t*maxRate)),
 };
}
export const SPOKEN_SALES_SEQUENCE='HOOK inmediato que frena el scroll -> PROBLEMA o deseo específico y por qué importa -> SOLUCIÓN explicada de manera concreta -> PRODUCTO presentado como el medio para aplicar esa solución -> USO y beneficio sustentado -> CTA hablado al final';
export const SALES_STRUCTURES=Object.freeze({
 ugc:'Creador real a cámara: '+SPOKEN_SALES_SEQUENCE+'. Voz en el 90-98% del clip, planos de apoyo con voz ininterrumpida, sin relleno ni presentación en modo catálogo.',
 cinematic:'Microhistoria visual filmada profesionalmente: escena de deseo/contexto -> producto en uso -> desenlace aspiracional plausible -> CTA visual. Solo producto o actores lifestyle según elección; nunca selfie.',
 premium:'Producto protagonista: hook visual de textura/escala -> uso real o escena aspiracional -> detalle diferenciador comprobable -> cierre de producto y CTA. Música y foley premium; voz en off opcional.',
 demo:'Hook de fricción -> problema específico -> solución práctica -> producto conectado a esa solución -> uso verdadero paso a paso -> beneficio observable -> CTA hablado. La narración acompaña cada acción y no deja huecos vacíos.',
});
export function salesBeatPlan(seconds,style='ugc',angle='auto'){
 const s=selectedStyle(style,'ugc');
 const t=Math.max(1,Math.min(120,Number(seconds)||8));
 // In short spoken ads the hook must be snappy; the rest is for the
 // complete commercial argument, including an explicit solution BEFORE
 // naming the product as its implementation.
 const spoken=s==='ugc'||s==='demo';
 const hookEnd=spoken?Math.min(2.2,Math.max(.6,t*0.15)):Math.min(3,t>=10?Math.max(2.2,t*0.24):t>=6?t*.28:t*.3);
 const after=t-hookEnd;
 const bounds=spoken
  ?[0,hookEnd,hookEnd+after*.21,hookEnd+after*.37,hookEnd+after*.69,hookEnd+after*.81,t]
  :[0,hookEnd,hookEnd+after*.23,hookEnd+after*.55,hookEnd+after*.79,t];
 const labels={
  ugc:['HOOK HABLADO','PROBLEMA CONCRETO','SOLUCIÓN EXPLICADA','PRODUCTO COMO VEHÍCULO DE LA SOLUCIÓN','USO/BENEFICIO','CTA HABLADO'],
  cinematic:['HOOK VISUAL','DESEO Y CONTEXTO','PRODUCTO EN LA HISTORIA','IMPACTO VISUAL','CIERRE + CTA'],
  premium:['HOOK DE DESEO','PRODUCTO PROTAGONISTA','ESCENA/USO PREMIUM','DETALLE Y BENEFICIO','CIERRE + CTA'],
  demo:['HOOK HABLADO','PROBLEMA PRÁCTICO','SOLUCIÓN PASO A PASO','PRODUCTO EN ACCIÓN','BENEFICIO OBSERVABLE','CTA HABLADO'],
 };
 return labels[s].map((name,i)=>({
  name,start:Number(bounds[i].toFixed(1)),end:Number(bounds[i+1].toFixed(1))
 }));
}
const hasProblem=script=>/(te pasa|te falta|falta|problema|buscas|quieres|cuesta|cansad|incómod|molesta|cuando|antes|necesita|deseas|quiero|me pasa|se te|prefieres)/i.test(script);
const hasSolution=script=>/(soluci[oó]n|por eso|as[ií] puedes|se puede|una forma|una manera|lo consigues|combina|para lograr|esto permite)/i.test(script);
const hasCTA=script=>/(escr[ií]b|p[ií]d|compr|consult|pregunt|descubr|conoce|env[ií]a|haz tu pedido|habla|whatsapp|adqui[eé]r)/i.test(script);
const badFiller=script=>/\b(hola chicos|bienvenidos a mi canal|soy tu presentador|no te lo puedes perder|producto incre[ií]ble|simplemente espectacular)\b/i.test(script);
const bareCatalogue=script=>/\bes (?:un |una )?(?:shampoo|perfume|gotero|frasco)|\bmira el combo\b/i.test(script)&&
 !/\b(te ayuda|para tu|para el|para la|soluci[oó]n|facilita|aporta|completa|beneficio|as[ií] puedes)\b/i.test(script);
export function scriptReadiness(script,{seconds=12,style='ugc'}={}){
 const words=speechWords(script),budget=voiceBudget(seconds,style);
 return {words,budget,tooShort:words<budget.minimum,tooLong:words>budget.maximum,
  weakStructure:!hasProblem(script)||!hasSolution(script)||!hasCTA(script)||badFiller(script)||bareCatalogue(script)};
}
const cleanSentence=(v,max=140)=>txt(v).replace(/^[“"']|[”"']$/g,'').slice(0,max).replace(/[,:;\s]+$/,'');
const stripEnd=v=>cleanSentence(v).replace(/[.!?]+$/,'');
function safeBenefits(report={}){
 const dossier=report.product_dossier||{};
 const claims=[
  ...(Array.isArray(report.verified_claims)?report.verified_claims:[]),
  ...(Array.isArray(dossier.realistic_uses)?dossier.realistic_uses:[]),
  ...(Array.isArray(dossier.features)?dossier.features:[]),
 ];
 return claims.map(x=>cleanSentence(x,82)).filter(x=>x&&x.length>5&&!/(garant|milagro|curaci[oó]n|feromonas|100%|resultados en|elimina para siempre)/i.test(x));
}
export function improveSalesScript(script,{
 seconds=12,style='ugc',productName='',description='',concept={},report={},language='es',
}={}){
 const original=txt(script);
 // Cinema and luxury films can be visual-first without spoken narration.
 if(style==='premium'||style==='cinematic')return original;
 const readiness=scriptReadiness(original,{seconds,style});
 // Preserve explicitly authored or foreign-language scripts. The rewrite is
 // a zero-API repair for AI-created Spanish concepts only.
 if(language!=='es'||!readiness.weakStructure&&!readiness.tooShort||!productName)return original;
 const budget=voiceBudget(seconds,style);
 const baseProduct=cleanSentence(productName,55)||'este producto';
 const hook=cleanSentence(concept.hook,115);
 const motive=cleanSentence(concept.buyer_motive||concept.reason,85);
 const category=cleanSentence(report?.product_dossier?.actual_category,65);
 const observations=safeBenefits(report);
 const relevant=observations[0]||category||'una opción para tu rutina';
 const cta=stripEnd(concept.cta||'Escríbenos para conocerlo');
 const closing=stripEnd(cta);
 // A limited number of verified/factual phrases fits the duration.
 const opening=hasProblem(hook)?stripEnd(hook):
  (motive?/\brutina|cabello|aroma|fragancia|salir/i.test(motive)?
   '¿Sientes que a tu rutina le falta un paso?':
   '¿Buscas una solución para tu día a día?':
   '¿Te falta una solución práctica?');
 const p=stripEnd(baseProduct);
 // Respect merchant-written product features as the source of proposed ad
 // language. Verification stays in the research report, not inserted as
 // disclaimers inside a sales script. Never invent absent features.
 const seller=txt(description);
 const names=p.replace(/^combo\s+/i,'').split(/\s*\+\s*/).map(x=>x.trim());
 const groomingCombo=names.length===2&&/shampoo|cabello|capilar/i.test(seller+' '+category)&&
   /perfume|fragancia|esencia|aroma/i.test(seller+' '+category);
 if(groomingCombo){
   const [hair,fragrance]=names;
   const pheromones=/feromonas/i.test(seller);
   const hairRole=/shampoo\s+perfumado/i.test(seller)?
     'shampoo perfumado para el cabello':'producto para el cabello';
   const fragranceRole=pheromones?'esencia de perfume con feromonas':'esencia perfumada';
   const opener=hasProblem(hook)?cleanSentence(hook):'¿Listo para salir?';
   const problem='A veces te arreglas el cabello pero olvidas preparar tu aroma antes de salir.';
   const solution='La solución es combinar el cuidado del cabello con un toque de fragancia.';
   const productLine='Por eso combina '+hair+', '+hairRole+', con '+fragrance+', '+fragranceRole+'.';
   const finishing='Así completas dos pasos de tu rutina antes de salir de casa.';
   const versions=[
     '¿Te falta algo al salir? Combina cabello y aroma: '+hair+' para tu cabello, '+fragrance+' para la fragancia. '+closing+'.',
     opener+' ¿Le falta algo a tu rutina? La solución es combinar cabello y aroma. Por eso usa '+hair+', '+hairRole+', junto con '+fragrance+', '+fragranceRole+'. '+closing+'.',
     opener+' ¿Le falta algo a tu rutina? La solución es combinar cabello y aroma. Por eso usa '+hair+', '+hairRole+', junto con '+fragrance+', '+fragranceRole+'. Dos pasos para tu preparación. '+closing+'.',
     opener+' '+problem+' '+solution+' '+productLine+' '+closing+'.',
     opener+' '+problem+' '+solution+' '+productLine+' '+finishing+' '+closing+'.',
     opener+' Al prepararte para salir, no basta con pensar solo en el cabello. También puedes elegir qué aroma llevar. '+solution+' '+productLine+' '+finishing+' '+closing+'.',
   ];
   // Choose by actual speech density, not by hard-coded 8/12/15-second
   // templates. For lengthy videos that need additional researched facts,
   // retain the original for seller review rather than repeating filler.
   const matching=versions.filter(v=>speechWords(v)>=budget.minimum&&speechWords(v)<=budget.maximum);
   if(matching.length)return matching.sort((a,b)=>
     Math.abs(speechWords(a)-budget.target)-Math.abs(speechWords(b)-budget.target))[0];
 }
 // A bundled shampoo + fragrance is a two-part routine, not an unexplained
 // catalogue of bottle names. Only use this relation if dossier confirms both.
 const plus=p.replace(/^combo\s+/i,'').split(/\s*\+\s*/).map(x=>x.trim());
 const dossier=report.product_dossier||{};
 const confirmed=[...(Array.isArray(dossier.features)?dossier.features:[]),
   ...(Array.isArray(report.verified_claims)?report.verified_claims:[])].join(' ');
 const categories=String(dossier.actual_category||'')+' '+confirmed;
 const twoStep=plus.length===2&&/shampoo|cabello|capilar/i.test(categories)&&
   /perfume|fragancia|esencia|aroma/i.test(categories);
 if(twoStep){
  const hookLine=hasProblem(hook)?stripEnd(hook):
    '¿Te falta algo al prepararte para salir?';
  const comboLine='Combina '+plus[0]+' y '+plus[1]+': uno para tu cabello y otro para tu aroma.';
  const benefitLine='Dos pasos para tu rutina.';
  const full=hookLine+' '+comboLine+' '+benefitLine+' '+closing+'.';
  if(speechWords(full)<=budget.maximum&&speechWords(full)>=budget.minimum)
   return full;
  const compact=hookLine+' '+plus[0]+' para el cabello y '+plus[1]+' para el aroma. '+closing+'.';
  if(speechWords(compact)>=budget.minimum&&speechWords(compact)<=budget.maximum)return compact;
 }

 const use=stripEnd(relevant);
 const choices=[
  opening+' '+p+' es una opción para '+use.toLowerCase()+'. Mira cómo encaja en tu rutina. '+closing+'.',
  opening+' '+p+' para '+use.toLowerCase()+'. Así puedes completar tu rutina de forma sencilla. '+closing+'.',
  opening+' Conoce '+p+': '+use+'. Una alternativa para tu rutina. '+closing+'.',
 ];
 const best=choices.find(x=>speechWords(x)<=budget.maximum&&speechWords(x)>=budget.minimum);
 if(best)return best;
 // Keep semantic stages even for long names or unusual durations;
 // never stretch weak content or silently truncate the seller's script.
 const shorter=opening+' '+p+': '+use+'. '+closing+'.';
 return speechWords(shorter)>=budget.minimum&&speechWords(shorter)<=budget.maximum?shorter:original;
}
