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
const hasProblem=script=>/(te pasa|te falta|falta|problema|buscas|quieres|cuesta|cansad|inc[oó]mod|molesta|cuando|antes|necesita|deseas|quiero|me pasa|se te|prefieres|olvid|descuid|impresion|verg[uü]enza|nadie)/i.test(script);
const hasSolution=script=>/(soluci[oó]n|por eso|as[ií] puedes|se puede|una forma|una manera|lo consigues|combina|para lograr|esto permite|empieza con|comienza con|puedes comenzar|incorpora|incluye|aplica|dedica|cuida tu piel con|se inicia con)/i.test(script);
const hasCTA=script=>/(escr[ií]b|p[ií]d|compr|consult|pregunt|descubr|conoce|env[ií]a|haz tu pedido|habla|whatsapp|adqui[eé]r)/i.test(script);
const badFiller=script=>/\b(hola chicos|bienvenidos a mi canal|soy tu presentador|no te lo puedes perder|producto incre[ií]ble|simplemente espectacular)\b/i.test(script);
// Product/photo analysis belongs in research evidence, NEVER in a human voice.
const photoNarration=script=>/(?:fotograf[ií]a|la foto|esta foto|foto identifica|foto muestra|imagen (?:muestra|identifica)|en la imagen|en la foto|marca visible|identifica la marca|se (?:observa|aprecia|distingue|lee)|envase (?:con|de|dice|muestra)|etiqueta (?:con|muestra|dice)|menciones? (?:de |sobre )?|texto legible|categor[ií]a hair care|hair care shampoo|en esta publicaci[oó]n|seg[uú]n (?:el vendedor|la ficha)|una alternativa para tu rutina)/i.test(script);
const vaguePitch=script=>/^(?:¿?buscas una soluci[oó]n para tu d[ií]a a d[ií]a|¿?te falta una soluci[oó]n pr[aá]ctica|¿?quieres una soluci[oó]n para tu rutina|¿?tu rutina se olvida)/i.test(txt(script));
const scentWords=/aroma|fragancia|perfume|perfumad|oler|hueles|olor/i;
const socialWords=/mujer|muej|mujre|mujers|chica|ella\b|atraer|atraccion|atractiv|seduc|conquist|irresisti|irrecis|impresion|primera impresi[oó]n|cita|halag|alago|miradas|enamorar/i;
export function buyerIntent(description='',concept={}){
 const seller=txt(description);
 const wantsSocialScent=scentWords.test(seller)&&socialWords.test(seller);
 return {socialScent:wantsSocialScent,bodyStriae:/estr[ií]a|stretch marks/i.test(seller),sellerPrimary:seller,reason:txt(concept.buyer_motive||concept.reason)};
}
const weakCTA=cta=>/^(?:conoce\b|descubre el producto\b|mira el producto\b)|en esta publicaci[oó]n/i.test(txt(cta));
export function commercialCta(cta,productName){
 const suggested=txt(cta);
 return !suggested||weakCTA(suggested)?'Pide '+txt(productName||'el producto')+' hoy':suggested;
}
export function spokenHook(script){
 const m=txt(script).match(/^.{5,125}?[?!]/);
 return m?m[0]:txt(script).split(/[.!]/)[0].slice(0,115);
}
const bareCatalogue=script=>/\bes (?:un |una )?(?:shampoo|perfume|gotero|frasco)|\bmira el combo\b/i.test(script)&&
 !/\b(te ayuda|para tu|para el|para la|soluci[oó]n|facilita|aporta|completa|beneficio|as[ií] puedes)\b/i.test(script);
export function scriptReadiness(script,{seconds=12,style='ugc',description=''}={}){
 const words=speechWords(script),budget=voiceBudget(seconds,style);
 const intent=buyerIntent(description);
 const mismatchedIntent=(intent.socialScent&&!scentWords.test(script))||
   (intent.bodyStriae&&!/estr[ií]a|marcas (?:de|en) (?:tu |la )?piel/i.test(script));
 const qualityIssues=[
   photoNarration(script)?'image_narration':null,
   vaguePitch(script)?'generic_hook':null,
   mismatchedIntent?'seller_desire_missing':null,
   badFiller(script)?'commercial_filler':null,
 ].filter(Boolean);
 return {words,budget,tooShort:words<budget.minimum,tooLong:words>budget.maximum,
  qualityIssues,
  weakStructure:!hasProblem(script)||!hasSolution(script)||!hasCTA(script)||bareCatalogue(script)||qualityIssues.length>0};
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
 return claims.map(x=>cleanSentence(x,82)).filter(x=>x&&x.length>5&&!photoNarration(x)&&!/(garant|milagro|curaci[oó]n|feromonas|100%|resultados en|elimina para siempre)/i.test(x));
}
// Factual, desire-led fallback for fragrance/grooming sales when a paid
// research answer recites the product photo rather than addressing the buyer.
// It NEVER promises romantic attraction or invents efficacy. Longer runtimes
// rely on the research model for unique substantiated detail, not filler.
function scentSocialCopy({seconds,productName,description,category='',cta=''}){
 const seller=txt(description),p=cleanSentence(productName,55);
 if(!buyerIntent(seller).socialScent)return null;
 const identity=seller+' '+category;
 const isShampoo=/shampoo|champ[uú]|hair care shampoo/i.test(identity);
 const isEssence=!isShampoo&&/esencia|extracto de perfume/i.test(identity);
 const isPerfume=!isShampoo&&!isEssence&&/perfume|colonia|fragancia/i.test(identity);
 const isDeodorant=!isShampoo&&!isEssence&&!isPerfume&&/desodorante/i.test(identity);
 const isSoap=!isShampoo&&!isEssence&&!isPerfume&&!isDeodorant&&/jab[oó]n/i.test(identity);
 if(!scentWords.test(seller)||p.includes('+'))return null;
 const role=isShampoo?'shampoo perfumado para el cabello':
   isEssence?'esencia de perfume':
   isPerfume?'perfume':
   isDeodorant?'desodorante':isSoap?'jabón perfumado':'producto con aroma';
 const article=isEssence?'una':'un';
 const productRole=p+', '+role;
 const productSentence=p+' es '+article+' '+role;
 const setting=isShampoo||isSoap?'en tu ducha':'antes de salir';
 const useAction=isShampoo?'durante el lavado del cabello':
   isSoap?'durante tu aseo':'cuando terminas de arreglarte';
 const closing=stripEnd(commercialCta(cta,p));
 const variants=[
  '¿Olvidas tu aroma? La solución: '+productRole+'. '+closing+'.',
  '¿Y tu aroma? Quieres impresionarla, pero olvidas cómo hueles. Por eso usa '+productRole+'. Completa tu rutina. '+closing+'.',
  '¿Quieres impresionarla? Puedes arreglarte impecable y olvidar cómo hueles. Por eso elige '+productRole+'. Dale ese detalle a tu rutina. '+closing+'.',
  '¿Quieres impresionarla? Piensa en el aroma que llevas. Si cuidas tu ropa, no olvides cómo hueles. La solución empieza '+setting+': '+productRole+'. Dale ese toque personal. '+closing+'.',
  '¿Quieres impresionarla? Piensa en el aroma que llevas. Si cuidas tu ropa, no olvides cómo hueles. La solución empieza '+setting+': '+productRole+'. Cuidar ese detalle también habla de tu estilo personal. Completa tu preparación antes de salir. '+closing+'.',
  '¿Quieres impresionarla? Piensa en el aroma que llevas. Si cuidas tu ropa, no olvides cómo hueles. Cuando te acercas a alguien, esos detalles forman parte de cómo te presentas. La solución empieza '+setting+': '+productRole+'. Úsalo '+useAction+' y completa ese toque de cuidado personal. '+closing+'.',
  '¿Quieres impresionarla? Cuando sales, eliges la ropa, cuidas el peinado y buscas sentirte bien. Pero a veces dejas tu aroma en segundo plano. Si vas a acercarte a alguien, ese detalle merece atención. La solución empieza '+setting+': '+productRole+'. Úsalo '+useAction+' y elige cómo quieres presentarte. No necesitas cambiar tu estilo: empieza por cuidar tu propia rutina y sus pequeños detalles. '+closing+'.',
  '¿Quieres impresionarla? Piensa en tu preparación antes de salir: eliges ropa, arreglas el cabello y cuidas cada detalle. ¿Pero qué pasa con tu aroma? A veces te concentras en cómo te ves y olvidas cómo quieres oler al acercarte a alguien. La solución comienza '+setting+': '+productRole+'. Puedes usarlo '+useAction+' para sumar fragancia a tu preparación. Tu aroma también forma parte de tu estilo. Cuida ese detalle en tu próxima salida. '+closing+'.',
 ];
 const budget=voiceBudget(seconds,'ugc');
 const fitting=variants.filter(v=>speechWords(v)>=budget.minimum&&speechWords(v)<=budget.maximum);
 if(!fitting.length)return null;
 return fitting.sort((a,b)=>Math.abs(speechWords(a)-budget.target)-Math.abs(speechWords(b)-budget.target))[0];
}
// Seller-grounded, non-medical buyer-pain speech for stretch-mark skin care.
// No claim that a cream removes marks or guarantees a cosmetic transformation.
// The text scales by spoken words; images never become source of claims.
function striaeSkinCareCopy({seconds,style,productName,description,concept={},report={}}){
 const seller=txt(description);
 const motive=txt(concept.buyer_motive||concept.reason);
 if(!buyerIntent(seller).bodyStriae)return null;
 const p=cleanSentence(productName,55);
 const category=txt(report?.product_dossier?.actual_category||'');
 const isCream=/crema|cream/i.test(seller+' '+category);
 const isOil=!isCream&&/aceite|oil/i.test(seller+' '+category);
 const role=isCream?', crema corporal':isOil?', aceite corporal':'';
 const massage=/masaje|masajear/i.test(seller+' '+motive+' '+txt(report?.selected_sales_angle));
 const routine=massage?'una rutina de masaje':'una rutina de cuidado corporal';
 const step=massage?'masaje corporal':'cuidado corporal';
 const closing=stripEnd(commercialCta(concept.cta,p));
 const choices=[
  '¿Te incomodan las estrías? Cuida tu piel con '+p+'. '+closing+'.',
  '¿Te incomoda mostrar tus estrías? La solución empieza con '+routine+'. Incluye '+p+role+'. '+closing+'.',
  '¿Te incomoda mostrar tus estrías? La solución empieza con '+routine+'. Incorpora '+p+role+' a tu cuidado. '+closing+'.',
  '¿Las estrías te incomodan? A veces afectan cómo te sientes al vestir. La solución empieza con '+routine+' y '+p+role+'. '+closing+'.',
  '¿Te incomoda mostrar tus estrías? El cuidado empieza con una rutina sencilla de '+step+'. Incorpora '+p+role+', a ese momento de autocuidado. Dale atención a tu piel. '+closing+'.',
  '¿Te incomoda mostrar tus estrías? El cuidado de la piel también merece tiempo. La solución comienza con '+routine+' que puedas mantener. Aplica '+p+role+' como parte de ese momento, sin complicarte. '+closing+'.',
  '¿Te incomoda mostrar tus estrías? A veces ese detalle te hace prestar más atención a la piel. La solución no está en prometer cambios de un día para otro, sino en dedicarte tiempo: una rutina de cuidado corporal. Puedes incorporar '+p+role+' al '+step+' y convertirlo en un momento de autocuidado. '+closing+'.',
  '¿Te incomoda mostrar tus estrías? Cuando ves esas marcas, quizá te preguntas cómo cuidar la apariencia de tu piel sin complicarte. Puedes comenzar con algo cotidiano: reservar unos minutos para '+routine+'. Incorpora '+p+role+' en ese momento, con una aplicación cómoda dentro de tus hábitos. El objetivo es darle atención a tu piel y a tu bienestar, sin esperar transformaciones instantáneas. Dale un espacio al autocuidado en tu día. '+closing+'.',
 ];
 const budget=voiceBudget(seconds,style);
 const fitting=choices.filter(v=>speechWords(v)>=budget.minimum&&speechWords(v)<=budget.maximum);
 return fitting.length?fitting.sort((a,b)=>Math.abs(speechWords(a)-budget.target)-Math.abs(speechWords(b)-budget.target))[0]:null;
}
// When salvaging a previously paid bad AI concept, repair the visual notes too.
// Never leave a strong voiceover attached to an unrelated photo-inspection montage.
export function alignedSpokenVideo({seconds=12,style='ugc',productName='',description='',script=''}={}){
 const beats=salesBeatPlan(seconds,style),duration=beats.at(-1).end;
 const problemEnd=beats[2].start,ctaStart=beats.at(-1).start;
 const p=cleanSentence(productName,55)||'el producto';
 const first=spokenHook(script);
 const intent=buyerIntent(description);
 const visualPain=intent.bodyStriae?
   'persona adulta reconoce la presencia natural de estrías en su piel, sin exageración ni vergüenza, y habla mirando a cámara':
   intent.socialScent?
     'persona adulta frente al espejo se prepara para salir y habla de la importancia del aroma para su primera impresión':
     'persona adulta muestra la situación cotidiana concreta planteada en el hook y la explica mirando a cámara';
 const usage=intent.bodyStriae?
   'muestra '+p+' y una aplicación corporal de cuidado o masaje cuando esa acción figure en la descripción, sin borrar estrías ni inventar un antes/después':
   intent.socialScent?
     'muestra el uso real de '+p+' cuando lo nombra, conservando envase, proporciones y aplicación auténticos':
     'presenta '+p+' cuando se menciona y demuestra únicamente el uso compatible con la descripción comercial';
 const beginning='0–'+problemEnd+' s: '+visualPain+'. Hook hablado literal: '+first+'. Voz continua.';
 const middle=problemEnd+'–'+ctaStart+' s: '+usage+'. La voz explica la solución y los beneficios sustentados sin pausas.';
 const end=ctaStart+'–'+duration+' s: la misma persona termina su CTA hablado mirando a cámara, con producto reconocible y sin promesas falsas.';
 const shots=style==='ugc'&&duration<=15?[beginning,middle+' '+end]:[beginning,middle,end];
 return {shots,video_prompt:'UGC realista de '+duration+' segundos. '+beginning+' '+middle+' '+end+' Sin narración sobre fotografías, marcas visibles o etiquetas. El producto se introduce en pantalla cuando la voz lo nombra. Mantener fidelidad del producto, expresiones humanas naturales y audio continuo.'};
}
export function improveSalesScript(script,{
 seconds=12,style='ugc',productName='',description='',concept={},report={},language='es',
}={}){
 const original=txt(script);
 // Cinema and luxury films can be visual-first without spoken narration.
 if(style==='premium'||style==='cinematic')return original;
 const readiness=scriptReadiness(original,{seconds,style,description});
 // Preserve explicitly authored or foreign-language scripts. The rewrite is
 // a zero-API repair for AI-created Spanish concepts only.
 if(language!=='es'||(!readiness.weakStructure&&!readiness.tooShort&&!readiness.tooLong)||!productName)return original;
 const budget=voiceBudget(seconds,style);
 const baseProduct=cleanSentence(productName,55)||'este producto';
 const hook=cleanSentence(concept.hook,115);
 const motive=cleanSentence(concept.buyer_motive||concept.reason,85);
 const category=cleanSentence(report?.product_dossier?.actual_category,65);
 const observations=safeBenefits(report);
 const relevant=observations[0]||category||'una opción para tu rutina';
 const cta=stripEnd(commercialCta(concept.cta,baseProduct));
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
 const skinDriven=striaeSkinCareCopy({seconds,style,productName:baseProduct,description:seller,concept,report});
 if(skinDriven)return skinDriven;
 const sellerDriven=scentSocialCopy({seconds,productName:baseProduct,description:seller,category,cta:concept.cta});
 if(sellerDriven)return sellerDriven;
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
     '¿Te falta aroma? Combina '+hair+' y '+fragrance+': cabello y fragancia. '+closing+'.',
     '¿Te falta algo al salir? Combina cabello y aroma: '+hair+' para tu cabello, '+fragrance+' para la fragancia. '+closing+'.',
     '¿Te falta algo al salir? La solución es combinar cabello y aroma. '+hair+' para el cabello y '+fragrance+' para la fragancia. Completa tu rutina. '+closing+'.',
     opener+' ¿Le falta algo a tu rutina? La solución es combinar cabello y aroma. Por eso usa '+hair+', '+hairRole+', junto con '+fragrance+', '+fragranceRole+'. '+closing+'.',
     opener+' ¿Le falta algo a tu rutina? La solución es combinar cabello y aroma. Por eso usa '+hair+', '+hairRole+', junto con '+fragrance+', '+fragranceRole+'. Dos pasos para tu preparación. '+closing+'.',
     opener+' '+problem+' '+solution+' '+productLine+' '+closing+'.',
     opener+' '+problem+' '+solution+' '+productLine+' '+finishing+' '+closing+'.',
     opener+' Al prepararte para salir, no basta con pensar solo en el cabello. También puedes elegir qué aroma llevar. '+solution+' '+productLine+' '+finishing+' '+closing+'.',
     opener+' Cuando terminas de arreglarte, el cabello y la fragancia son dos pasos distintos: uno no reemplaza al otro. La solución es completar ambas partes de tu rutina. Por eso el combo reúne '+hair+', '+hairRole+', con '+fragrance+', '+fragranceRole+'. Primero atiendes tu cabello, después eliges tu fragancia. Así organizas dos momentos de tu preparación antes de salir. Puedes revisar el detalle de cada producto y decidir si encajan en tus hábitos. '+closing+'.',
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

 // Photo metadata is never a spoken benefit or a substitute for the seller's
 // value proposition. Don't replace weak copy with a sales script that merely
 // reads the photograph or repeats generic routine language.
 const use=stripEnd(relevant);
 if(photoNarration(use)||/una opci[oó]n para tu rutina|hair care|fotograf[ií]a|envase/i.test(use))return original;
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


/**
 * Prevent three concept cards from repeating the same deterministic perfume
 * fallback. No extra provider call, and no fictional attraction/health claims.
 * Preserve distinct source scripts; the customer may edit each afterwards.
 */
export function distinctConceptSpeeches(concepts,{productName='',description='',language='es'}={}){
 if(!Array.isArray(concepts)||concepts.length!==3||language!=='es')return concepts;
 const original=concepts.map(c=>txt(c.spoken_script||c.script));
 if(new Set(original.map(x=>x.toLowerCase())).size===3)return concepts;
 const scent=/perfume|fragancia|esencia perfumad|aroma|colonia/i.test(description);
 if(!scent)return concepts;
 const p=cleanSentence(productName||'el producto',55);
 const variants=[
  '¿Quieres causar una buena primera impresión? Tu aroma también cuenta. Incorpora '+p+' a tu preparación antes de salir. Pídelo por mensaje.',
  'Antes de salir, cuida cada detalle, incluido tu aroma. '+p+' acompaña tu rutina con una fragancia personal. Escríbenos para pedirlo.',
  'Tu sello personal está en los detalles. Cuando termines de arreglarte, elige tu aroma con '+p+'. Completa tu preparación y haz tu pedido.',
 ];
 return concepts.map((c,i)=>{
  if(original[i] && original.indexOf(original[i])===i)return c;
  const script=variants[i];
  return {...c,spoken_script:script,script,hook:spokenHook(script)};
 });
}
