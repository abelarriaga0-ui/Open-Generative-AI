// REALIZO commercial grammar derived from the user's NMF production playbook.
// Each format has its own persuasive structure and visual language; the provider
// must NOT turn every strategy into the same glossy product montage.
export const CREATIVE_FORMATS=Object.freeze(['ugc','cinematic','premium','demo']);
export const FORMAT_GUIDES=Object.freeze({
 ugc:{
  purpose:'Confianza y explicación humana directa',
  structure:'Hook hablado específico → situación real → presentación informada → demostración breve → beneficio verificable → objeción útil → CTA hablado',
  camera:'Video vertical desde teléfono de un creador adulto, encuadre cercano, mirada a lente, piel con textura natural, micromovimientos de mano, ritmo conversado',
  audio:'La persona habla en casi todo el video con diálogo realista, no música estética ni silent beauty shots; solo cortes cortos de apoyo manteniendo voz',
  forbidden:'Montajes de productos, movimiento de slider, tomas hero prolongadas, guion reducido a dos frases, testimonio inventado',
 },
 cinematic:{
  purpose:'Deseo y contexto mediante una microhistoria creíble con acción y resolución',
  structure:'Hook visual disruptivo → problema/deseo → producto en acción dentro de una historia → beneficio sugerido y claro → CTA',
  camera:'Planos cinematográficos con continuidad espacial, luz motivada, actor natural, movimiento de cámara elegante SOLO si cumple una función narrativa',
  audio:'Voz narrativa breve o diálogo funcional; el producto y la historia visual pueden dominar, sin forzar selfie-UGC',
  forbidden:'Selfie a cámara constante, catálogo de envases giratorios, secuencia sin motivo de compra, publicidad de perfume sin argumento',
 },
 premium:{
  purpose:'Valor percibido, detalle diferencial y experiencia aspiracional verificable',
  structure:'Hook de detalle o deseo → propuesta de valor concreta → textura/material o uso real → razón para creer → CTA premium',
  camera:'Fotografía comercial cuidada, luz controlada realista, textura de materiales, gestos precisos, producto fiel y protagonista, edición elegante',
  audio:'Locución contenida y convincente o palabras mínimas cuidadosamente elegidas; no fingir una reseña humana',
  forbidden:'Selfie-UGC, hipérboles falsas, luces CGI, slow motion sin argumento, inventar exclusividad o lujo de marca',
 },
 demo:{
  purpose:'Mostrar funcionamiento y resolver dudas mediante evidencia visual',
  structure:'Acción gancho → qué es → uso paso a paso → detalle observable → resultado real → CTA',
  camera:'Manos y producto en uso real, enfoque en mecanismo y escala, primeros planos funcionales, no trucos de transformación',
  audio:'Voz en off breve describiendo exactamente lo que se ve y condiciones reales; la demostración lleva la venta',
  forbidden:'Primeros planos de un actor que habla todo el tiempo, efectos estéticos que oculten uso, resultados milagrosos, testimonio simulado',
 },
});
export function formatGuide(style){
 return FORMAT_GUIDES[style]||FORMAT_GUIDES.ugc;
}
export function selectedStyle(projectStyle,conceptStyle){
 return CREATIVE_FORMATS.includes(projectStyle)?projectStyle:
  CREATIVE_FORMATS.includes(conceptStyle)?conceptStyle:'ugc';
}
export function researchQualityCriteria({seconds,style}={}){
 const t=Math.max(1,Number(seconds)||8);
 return {
  maxShots:style==='ugc'?(t<=15?2:t<=30?3:5):t<=8?3:t<=15?4:t<=30?6:9,
  minSpeechWords:style==='ugc'?Math.max(5,Math.floor(t*1.4)):0,
  maxSpeechWords:style==='ugc'?Math.max(6,Math.floor(t*2.4)):Math.max(9,Math.floor(t*2.4)),
 };
}
