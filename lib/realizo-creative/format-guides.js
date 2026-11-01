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
  editing:'Montaje nativo de creador: cortes al ritmo del habla, jump cuts discretos, una breve toma de apoyo, sin efecto publicitario que rompa la espontaneidad',
  transitions:'Corte directo casi siempre, jump-cut justificado para eliminar pausas; no whip pan, flash ni transiciones de cine de estudio',
  effects:'Corrección natural de piel, exposición y color; nada de piel plástica, lens flares, partículas o motion graphics excesivos',
  sound_design:'Voz humana clara y continua, sonido ambiente auténtico y música baja sin tapar las palabras',
  forbidden:'Montajes de productos, movimiento de slider, tomas hero prolongadas, guion reducido a dos frases, testimonio inventado',
 },
 cinematic:{
  purpose:'Deseo y contexto mediante una microhistoria creíble con acción y resolución',
  structure:'Hook visual disruptivo → problema/deseo → producto en acción dentro de una historia → beneficio sugerido y claro → CTA',
  camera:'Planos cinematográficos con continuidad espacial, luz motivada, actor natural, movimiento de cámara elegante SOLO si cumple una función narrativa',
  audio:'Voz narrativa o diálogo continuo que sostiene la microhistoria de venta; los planos de apoyo no interrumpen el argumento comercial',
  editing:'Montaje cinematográfico con ritmo y escalada emocional: contraste de planos, cortes motivados por acción, continuidad de miradas y movimientos, revelación del producto en el punto de giro',
  transitions:'Match cuts entre gesto y producto, cortes sobre acción y puentes sonoros J/L; un whip pan o speed ramp sutil SOLO si está motivado y es físicamente viable',
  effects:'Profundidad de campo natural, contraste cinematográfico equilibrado, desenfoque de movimiento realista, gradación de color consistente, grano fino y halo óptico sutil solo cuando lo justifique la luz',
  sound_design:'Ambiente real, foley puntual de uso del producto, transición de sonido que conecta escenas, música dinámica bajo la locución; no cortes mudos ni golpes de sonido constantes',
  forbidden:'Selfie a cámara constante, catálogo de envases giratorios, secuencia sin motivo de compra, publicidad de perfume sin argumento',
 },
 premium:{
  purpose:'Valor percibido, detalle diferencial y experiencia aspiracional verificable',
  structure:'Hook de detalle o deseo → propuesta de valor concreta → textura/material o uso real → razón para creer → CTA premium',
  camera:'Fotografía comercial cuidada, luz controlada realista, textura de materiales, gestos precisos, producto fiel y protagonista, edición elegante',
  audio:'Locución elegante y clara durante casi toda la microhistoria; pausas muy breves y significativas, jamás tomas largas sin contenido comercial',
  editing:'Edición premium deliberada: pocos planos con foco en tacto, uso y valor percibido, timing preciso de gestos y cortes que revelan detalles relevantes',
  transitions:'Match cut limpio entre materiales, cortes suaves sobre movimiento, disolvencia breve solo cuando conecta tiempo o espacio; evitar plantillas y transiciones aparatosas',
  effects:'Gradación de color refinada, brillos reales, macro óptico y enfoque selectivo físicamente plausibles; pequeños acentos de luz y textura, no CGI brillante ni producto flotante',
  sound_design:'Foley preciso de tapa, gotero o dispensador si se ve y ocurre realmente, música discreta de calidad y locución protagonista',
  forbidden:'Selfie-UGC, hipérboles falsas, luces CGI, slow motion sin argumento, inventar exclusividad o lujo de marca',
 },
 demo:{
  purpose:'Mostrar funcionamiento y resolver dudas mediante evidencia visual',
  structure:'Acción gancho → qué es → uso paso a paso → detalle observable → resultado real → CTA',
  camera:'Manos y producto en uso real, enfoque en mecanismo y escala, primeros planos funcionales, no trucos de transformación',
  audio:'Voz en off continua y precisa que describe problema, pasos, utilidad observada y CTA; no silencios mientras se muestra funcionamiento',
  editing:'Edición funcional por acciones, ritmo suficientemente rápido para entender el uso y el antes/contexto sin alterar la secuencia física',
  transitions:'Corte sobre acción, plano-detalle y acercamiento discreto para enseñar un mecanismo; no efectos que oculten si realmente funciona',
  effects:'Zoom corto guiando la vista o realce de foco moderado; ningún antes/después fabricado, texto inventado o transformación mágica',
  sound_design:'Voz clara sobre los pasos, sonido auténtico del producto cuando existe; no música invasiva ni silencios vacíos',
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
