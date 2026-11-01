// NMF: hook -> recognizable friction/desire -> product -> use/benefit -> CTA.
// Audio density is a planning target, never a promise of native provider speech.
// No new model/API call and no newly invented product effects.
import {selectedStyle} from './format-guides.js';
const txt=v=>String(v||'').replace(/\s+/g,' ').trim();
export const speechWords=v=>txt(v).split(/\s+/).filter(Boolean).length;
export function voiceBudget(seconds,style='ugc'){
 const t=Math.max(1,Math.min(120,Number(seconds)||8));
 const rates={
  ugc:[2.05,2.48],cinematic:[1.75,2.34],
  premium:[1.65,2.22],demo:[1.85,2.42],
 };
 const [minRate,maxRate]=rates[style]||rates.ugc;
 return {
  minimum:Math.max(4,Math.floor(t*minRate)),
  target:Math.max(5,Math.round(t*(minRate+maxRate)/2)),
  maximum:Math.max(7,Math.floor(t*maxRate)),
 };
}
export const SALES_STRUCTURES=Object.freeze({
 ugc:'Creador real a cámara: pregunta o problema cotidiano -> por qué importa -> producto visible como respuesta -> un detalle de uso o beneficio respaldado -> CTA hablado. Voz en el 85-95% del clip, planos de apoyo con voz ininterrumpida.',
 cinematic:'Microhistoria visual: persona enfrenta fricción o deseo -> producto aparece como respuesta durante la acción -> uso y desenlace creíble -> beneficio y CTA en voz en off. No convertir en selfie ni catálogo sin narración.',
 premium:'Deseo o necesidad en contexto -> producto como respuesta -> uso/tacto/detalle real que justifica el valor -> CTA elegante. Locución que une las tomas; no escenas largas solo con música.',
 demo:'Problema práctico visible -> producto en manos -> uso verdadero paso a paso -> beneficio observable -> CTA en voz en off. La acción aporta prueba; la narración acompaña todo el proceso.',
});
export function salesBeatPlan(seconds,style='ugc',angle='auto'){
 const s=selectedStyle(style,'ugc');
 const t=Math.max(1,Math.min(120,Number(seconds)||8));
 // A scroll-stopping hook is a short 0-3s opening, NOT the whole story.
 // At 12s aim at 2.9s; in very short ads shrink it proportionally.
 // All other beats occupy the remaining duration and reach a spoken CTA.
 const hookEnd=Math.min(3,t>=10?Math.max(2.2,t*0.24):t>=6?t*0.28:t*0.3);
 const after=t-hookEnd;
 const bounds=[0,hookEnd,hookEnd+after*0.23,hookEnd+after*0.55,
   hookEnd+after*0.79,t];
 const labels={
  ugc:['HOOK HABLADO','PROBLEMA/DESEO','PRODUCTO COMO SOLUCIÓN','USO/BENEFICIO','CTA HABLADO'],
  cinematic:['HOOK VISUAL + LOCUCIÓN','FRICCIÓN HUMANA','PRODUCTO EN LA HISTORIA','CAMBIO / BENEFICIO','CTA HABLADO'],
  premium:['HOOK DE DESEO','NECESIDAD CONCRETA','PRODUCTO COMO RESPUESTA','DETALLE Y BENEFICIO','CTA NARRADO'],
  demo:['HOOK: PROBLEMA VISIBLE','FRICCIÓN','PRODUCTO EN ACCIÓN','USO/RESULTADO OBSERVABLE','CTA HABLADO'],
 };
 return labels[s].map((name,i)=>({
  name,start:Number(bounds[i].toFixed(1)),end:Number(bounds[i+1].toFixed(1))
 }));
}
const hasProblem=script=>/(te pasa|te falta|falta|problema|buscas|quieres|cuesta|cansad|incómod|molesta|cuando|antes|necesita|deseas|quiero|me pasa|se te|prefieres)/i.test(script);
const hasCTA=script=>/(escr[ií]b|p[ií]d|compr|consult|pregunt|descubr|conoce|env[ií]a|haz tu pedido|habla|whatsapp|adqui[eé]r)/i.test(script);
const badFiller=script=>/\b(hola chicos|bienvenidos a mi canal|soy tu presentador|no te lo puedes perder|producto incre[ií]ble|simplemente espectacular)\b/i.test(script);
const bareCatalogue=script=>/\bes (?:un |una )?(?:shampoo|perfume|gotero|frasco)|\bmira el combo\b/i.test(script)&&
 !/\b(te ayuda|para tu|para el|para la|soluci[oó]n|facilita|aporta|completa|beneficio|as[ií] puedes)\b/i.test(script);
export function scriptReadiness(script,{seconds=12,style='ugc'}={}){
 const words=speechWords(script),budget=voiceBudget(seconds,style);
 return {words,budget,tooShort:words<budget.minimum,tooLong:words>budget.maximum,
  weakStructure:!hasProblem(script)||!hasCTA(script)||badFiller(script)||bareCatalogue(script)};
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
 // The merchant's stated positioning informs persuasive copy without turning
 // unverified performance into independently proven facts. The advertisement
 // can mention a marketed feature AS a seller/brand claim.
 const seller=txt(description);
 const names=p.replace(/^combo\s+/i,'').split(/\s*\+\s*/).map(x=>x.trim());
 const groomingCombo=names.length===2&&/shampoo|cabello|capilar/i.test(seller+' '+category)&&
   /perfume|fragancia|esencia|aroma/i.test(seller+' '+category);
 if(groomingCombo){
   const [hair,fragrance]=names;
   const pheromones=/feromonas/i.test(seller);
   const daylong=/\b24\s*(?:horas|h)\b/i.test(seller);
   const hairRole=/shampoo\s+perfumado/i.test(seller)?
     'shampoo perfumado para el cabello':'para el cabello';
   const fragranceRole=pheromones?'esencia anunciada con feromonas':'esencia perfumada';
   const statedDuration=daylong?' y fijación de hasta 24 horas':'';
   // First 2–3 seconds: relatable desire, not a product inventory.
   const candidate15='¿Quieres destacar esta noche? Combina '+
     hair+', '+hairRole+', con '+fragrance+', '+fragranceRole+
     statedDuration+'. Dos pasos para completar tu rutina antes de salir. ¡Pide el combo hoy!';
   const candidate12='¿Te falta algo antes de salir? '+hair+' para tu cabello y '+
     fragrance+', '+fragranceRole+', para tu aroma. Completa tu rutina. '+
     (pheromones?'¡Pide el combo hoy!':closing+'.');
   const candidate8='¿Sales hoy? '+hair+' para el cabello y '+fragrance+
     ' para el aroma. Completa tu rutina. ¡Escríbenos!';
   // Use the longest strong copy that actually fits the purchased runtime.
   const options=seconds>=13?[candidate15,candidate12,candidate8]:
     seconds>=10?[candidate12,candidate8]:[candidate8];
   const fitting=options.find(c=>speechWords(c)>=budget.minimum&&
     speechWords(c)<=budget.maximum);
   if(fitting)return fitting;
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
  if(speechWords(compact)<=budget.maximum)return compact;
 }

 const use=stripEnd(relevant);
 const choices=[
  opening+' '+p+' es una opción para '+use.toLowerCase()+'. Mira cómo encaja en tu rutina. '+closing+'.',
  opening+' '+p+' para '+use.toLowerCase()+'. Así puedes completar tu rutina de forma sencilla. '+closing+'.',
  opening+' Conoce '+p+': '+use+'. Una alternativa para tu rutina. '+closing+'.',
 ];
 const best=choices.find(x=>speechWords(x)<=budget.maximum&&speechWords(x)>=budget.minimum);
 if(best)return best;
 // Keep semantic stages even when the products have long names; never truncate
 // at a mid-word or force unnatural speech to fill 12 seconds.
 const shorter=opening+' '+p+': '+use+'. '+closing+'.';
 return speechWords(shorter)<=budget.maximum?shorter:original;
}
