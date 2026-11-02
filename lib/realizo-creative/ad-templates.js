/**
 * REALIZO V11 — reusable, server-validated advertising templates.
 * Fixed direction is enforced in research AND the final generation prompt.
 * Product, market, CTA, actor and setting stay editable. These represent
 * creative structures, not pixel-identical video motion transfers.
 */
const phases=(hook,problem,solution,proof,cta)=>[
 {key:'hook',label:hook,share:.17},
 {key:'context',label:problem,share:.20},
 {key:'product',label:solution,share:.26},
 {key:'benefit',label:proof,share:.21},
 {key:'cta',label:cta,share:.16},
];
export const AD_TEMPLATES=Object.freeze([
 {
  id:'ugc-vendedor',name:'UGC Vendedor',short:'Conecta, muestra y convence.',
  style:'ugc',group:'UGC',duration:15,tag:'Más popular',icon:'✦',visual:0,
  angle:'benefits',camera:'Selfie vertical auténtico, rostro visible la mayor parte del tiempo, cámara de teléfono y luz natural.',
  editing:'Jump cuts breves y cortes sobre la voz sin interrumpir el discurso.',transition:'Cortes directos naturales, sin transiciones cinematográficas.',
  audio:'Habla directa y continua a cámara con tono de recomendación, CTA explícito.',effect:'Color natural, rostro realista, producto sin alteraciones.',
  description:'Creador a cámara mostrando el producto y resolviendo una necesidad.',
  beats:phases('Pregunta corta que frena el scroll','Problema cotidiano del comprador','Enseñar el producto en la mano','Uso concreto y beneficio del comprador','Invitación directa a comprar'),
  editable:['producto','descripción','actor','escenario','mercado','idioma','CTA','duración'],
 },
 {
  id:'premium-producto',name:'Premium Producto',short:'Luz, textura y valor percibido.',
  style:'premium',group:'Premium',duration:15,tag:'Acabado premium',icon:'✧',visual:1,
  angle:'premium',camera:'Macrofotografía realista, luces de estudio, reflejos controlados, envase perfectamente estable.',
  editing:'Montaje refinado de detalles, uso real y cierre hero sin imágenes flotantes.',
  transition:'Match cuts entre materiales, transición luminosa breve motivada, cortes suaves sobre acción.',
  audio:'Locución elegante continua y foley realista de apertura, aplicación o cierre.',
  effect:'Gradación ámbar y negros profundos; halos ópticos sutiles y textura real del material.',
  description:'Anuncio sensorial con iluminación de estudio y acabados de lujo.',
  beats:phases('Detalle deslumbrante del producto','Situación de uso aspiracional','Manos usan el producto correctamente','Textura, beneficio relevante y sensaciones','Producto firme con CTA claro'),
  editable:['producto','descripción','escenario','mercado','idioma','CTA','duración','actor'],
 },
 {
  id:'demo-uso',name:'Demostración',short:'Enseña el producto en acción.',
  style:'demo',group:'Demo',duration:20,tag:'Uso real',icon:'◈',visual:2,
  angle:'demo',camera:'Primeros planos de manos reales usando el producto en secuencia lógica.',
  editing:'Pasos ordenados y cortes funcionales en torno a la demostración.',
  transition:'Corte sobre acción; acercamientos discretos al detalle que se explica.',
  audio:'Voz en off casi continua que narra lo que ocurre, foley real bajo la voz.',
  effect:'Sin magia, resultados imposibles, CGI ni antes/después falsos.',
  description:'Muestra cómo funciona, cuándo se utiliza y por qué importa.',
  beats:phases('Resultado práctico que despierta curiosidad','Necesidad o dificultad concreta','Paso uno: empezar a utilizarlo','Paso dos: mostrar lo que hace','Beneficio y CTA directo'),
  editable:['producto','descripción','actor','escenario','mercado','idioma','CTA','duración'],
 },
 {
  id:'problema-solucion',name:'Problema / Solución',short:'Del dolor a una respuesta clara.',
  style:'ugc',group:'UGC',duration:20,tag:'Alto impacto',icon:'◎',visual:3,
  angle:'problem',camera:'Creador natural a cámara y una inserción breve del problema y la solución.',
  editing:'Contraste narrativo muy claro antes y después del descubrimiento; sin resultados inventados.',
  transition:'Jump cut del problema a la demostración sobre una frase puente.',
  audio:'Presentador dialoga casi sin silencios, con problema, alivio y CTA.',
  effect:'Encuadres cotidianos, color natural y texto solo si se añade posteriormente.',
  description:'Conecta con el problema y presenta el producto como solución.',
  beats:phases('Pregunta sobre molestia real','Por qué esa molestia importa','Introducir el producto como respuesta','Uso y beneficio concreto, sin falsificar pruebas','CTA útil y específico'),
  editable:['producto','descripción','actor','escenario','mercado','idioma','CTA','duración'],
 },
 {
  id:'testimonio-guiado',name:'Testimonio',short:'Opinión cercana y demostración.',
  style:'ugc',group:'UGC',duration:15,tag:'Confianza',icon:'★',visual:4,
  angle:'ugc',camera:'Entrevista selfie natural, contacto visual, expresión creíble y producto en mano.',
  editing:'Una presentación fluida con inserciones discretas de uso real.',
  transition:'Cortes espontáneos de creador, no transiciones de anuncio de lujo.',
  audio:'Guion en primera persona como presentación dramatizada; no fingir experiencia real no proporcionada.',
  effect:'Piel humana, acentos mínimos de color, sin filtros que resten credibilidad.',
  description:'Estilo recomendación interpretada, nunca reseña real inventada.',
  beats:phases('Motivo por el que se interesó','Necesidad habitual del público','Presentación honesta del producto','Uso demostrable y datos facilitados','CTA conversacional'),
  editable:['producto','descripción','actor','escenario','mercado','idioma','CTA','duración'],
 },
 {
  id:'oferta-directa',name:'Oferta Directa',short:'La propuesta y el CTA.',
  style:'premium',group:'Ofertas',duration:15,tag:'Ventas rápidas',icon:'↗',visual:5,
  angle:'offer',camera:'Producto real en plano hero, breve demostración e identidad visual estable.',
  editing:'Cortes enérgicos entre ventaja, propuesta confirmada y llamado a la acción.',
  transition:'Cortes al ritmo de la voz; cambio de escala al CTA.',
  audio:'Locución comercial clara, ritmo elevado pero comprensible.',
  effect:'Luces premium, acento ámbar. No inventar descuentos, precio ni urgencia.',
  description:'Anuncio dinámico con una propuesta comercial concreta.',
  beats:phases('Gancho centrado en la oportunidad','Necesidad que resuelve la compra','Producto y lo que incluye','Oferta solo si el vendedor la facilitó','CTA para comprar o escribir'),
  editable:['producto','descripción','escenario','mercado','idioma','CTA','duración','actor'],
 },
 {
  id:'cinematografico',name:'Historia Cinematográfica',short:'Escenas que generan emoción.',
  style:'cinematic',group:'Cine',duration:20,tag:'Narrativa visual',icon:'◇',visual:6,
  angle:'lifestyle',camera:'Movimientos motivados, luz dramática natural, continuidad de actor y ambiente.',
  editing:'Microhistoria causa–efecto con crescendo, ritmo de edición y cierre comercial.',
  transition:'Match cut, corte en movimiento y puente sonoro J/L; speed ramp moderado si encaja.',
  audio:'Locución narrativa sobre el relato visual, efectos ambientales y música baja.',
  effect:'Gradación cinematográfica, profundidad de campo óptica plausible y reflejos reales.',
  description:'Historia breve con conflicto, producto, cambio y cierre.',
  beats:phases('Situación visual llamativa','Conflicto cotidiano del protagonista','Descubrimiento y uso del producto','Cambio de intención y beneficio realista','Cierre emotivo y CTA'),
  editable:['producto','descripción','actor','escenario','mercado','idioma','CTA','duración'],
 },
 {
  id:'comparativo',name:'Comparativo',short:'Dos enfoques en un solo anuncio.',
  style:'demo',group:'Demo',duration:20,tag:'Explicación clara',icon:'⇄',visual:7,
  angle:'benefits',camera:'Composición dividida coherente para dos situaciones, producto real en manos.',
  editing:'Alternancia clara entre necesidad inicial y utilidad del producto, sin pruebas fabricadas.',
  transition:'Cortes paralelos y transición directa para el contraste.',
  audio:'Voz expositiva continua y CTA, sin largos montajes silenciosos.',
  effect:'Pantalla partida y rótulos solo mediante postproducción cuando esté disponible.',
  description:'Comparación funcional con hechos concretos, sin inventar resultados.',
  beats:phases('Comparación que abre curiosidad','Describir la situación inicial','Mostrar el producto y cómo se usa','Diferencia respaldada por datos del vendedor','CTA para conocer más'),
  editable:['producto','descripción','escenario','mercado','idioma','CTA','duración','actor'],
 },
]);
const byId=new Map(AD_TEMPLATES.map(item=>[item.id,item]));
export function getAdTemplate(id){return typeof id==='string'?byId.get(id)||null:null;}
export function validateAdTemplate(id){
 if(id===undefined||id===null||id==='')return null;
 const t=getAdTemplate(id);
 if(!t)throw Error('invalid_ad_template');
 return t;
}
export function templatePlan(templateOrId,duration=15){
 const t=typeof templateOrId==='string'?getAdTemplate(templateOrId):templateOrId;
 if(!t)return [];
 const seconds=Number(duration);
 if(!Number.isFinite(seconds)||seconds<=0)return [];
 const hookEnd=Math.min(3,seconds>=10?Math.max(2,Math.min(3,seconds*.19)):seconds*.25);
 const remainder=seconds-hookEnd;
 let point=0;
 return t.beats.map((beat,i)=>{
  const start=point;
  const end=i===0?hookEnd:i===t.beats.length-1?seconds:
    start+remainder*(beat.share/.83);
  point=end;
  return {key:beat.key,label:beat.label,start:Number(start.toFixed(1)),end:Number(end.toFixed(1))};
 });
}
export function templateDirection(id,duration,{actor='auto',setting='auto'}={}){
 const t=getAdTemplate(id);
 if(!t)return '';
 const normalizedActor=['auto','hombre','mujer'].includes(actor)?actor:'auto';
 const cleanSetting=String(setting||'auto').replace(/[<>\r\n]/g,' ').slice(0,120);
 return [
  'REALIZO TEMPLATE LOCKED: '+t.id+' | '+t.name+'. Preserve the exact narrative format, shot roles, edit rhythm and transitions even when product changes.',
  'CUSTOMIZE ONLY product identity, seller-approved claims, actor ('+normalizedActor+'), environment ('+cleanSetting+'), market, language, timing and CTA.',
  'STORYBOARD '+duration+'s: '+templatePlan(t,duration).map(b=>b.start+'-'+b.end+'s '+b.key+'='+b.label).join(' | ')+'.',
  'CAMERA: '+t.camera+'. EDITING: '+t.editing+'. TRANSITIONS: '+t.transition+'. AUDIO: '+t.audio+'. EFFECTS: '+t.effect+'.',
  'VIDEO REFERENCE LIMIT: this is a reusable creative sequence, NOT pixel-identical motion transplantation. Keep physical product identity, commercial storyline and realistic human acting.'
 ].join(' ');
}
