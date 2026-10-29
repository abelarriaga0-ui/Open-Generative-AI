export const SALES_ANGLES = Object.freeze([
  {id:'auto',name:'Recomendado'},
  {id:'demo',name:'Demostración'},
  {id:'problem',name:'Problema → solución'},
  {id:'ugc',name:'UGC natural'},
  {id:'benefits',name:'Beneficios'},
  {id:'comparison',name:'Comparación'},
  {id:'premium',name:'Premium'},
  {id:'offer',name:'Oferta'},
]);
const instructions={
  demo:'Demostrar de forma clara cómo se usa el producto, con planos detalle, manipulación realista y resultados visibles.',
  problem:'Abrir con una situación cotidiana relevante y pasar a una demostración del producto como posible solución; no prometer resultados garantizados.',
  ugc:'Estética de video casero auténtico, encuadres de teléfono, lenguaje cercano y movimientos naturales; no inventar testimonios reales.',
  benefits:'Priorizar las características y ventajas comprobables del producto a través de imágenes fáciles de entender.',
  comparison:'Contrastar usos y atributos verificables sin inventar datos ni desacreditar competidores.',
  premium:'Presentación editorial refinada, luz natural cuidada, movimientos de cámara lentos y enfoque en detalles de materiales.',
  offer:'Destacar una oferta únicamente si el usuario ha proporcionado un precio o promoción verificable; evitar urgencia inventada.',
};
export function suggestSalesAngle(text) {
  const source=String(text||'').toLocaleLowerCase('es');
  if(/precio|descuento|promoción|promocion|oferta/.test(source))return 'offer';
  if(/aplicar|instalar|paso a paso|cómo usar|modo de uso|instrucciones/.test(source))return 'demo';
  if(/problema|molestia|dolor|necesidad|dificultad/.test(source))return 'problem';
  if(/calidad|exclusiv|lujo|premium|artesanal/.test(source))return 'premium';
  return 'demo';
}
export function summarizeProductDocument(text) {
  const normalized=String(text||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim().slice(0,16000);
  if(!normalized)return {summary:'',highlights:[]};
  const lines=normalized.split(/\n+/).map(l=>l.trim()).filter(l=>l.length>12&&l.length<500);
  const highlights=lines.filter(l=>/benefici|característic|ingrediente|material|modo de uso|para qué|uso|precaución|advertencia|composic|producto|concentrac/i.test(l)).slice(0,8);
  return {summary:normalized.slice(0,4500),highlights:highlights.length?highlights:lines.slice(0,6)};
}
export function buildVideoBrief({productName='',description='',documentText='',audience='',objective='ventas',angle='auto',tone='natural',cta='',references=0}={}) {
  const name=String(productName).trim().slice(0,150);
  const desc=String(description).trim().slice(0,1600);
  const doc=summarizeProductDocument(documentText);
  const chosen=angle==='auto'?suggestSalesAngle(name+' '+desc+' '+doc.summary):angle;
  const focus=instructions[chosen]||instructions.demo;
  const lines=[
    'Video publicitario de producto para Realizo.',
    name ? 'Producto: '+name+'.' : 'Producto: conservar fielmente la apariencia del objeto de la imagen principal.',
    desc ? 'Descripción proporcionada: '+desc : null,
    audience ? 'Público objetivo: '+String(audience).trim().slice(0,200)+'.' : null,
    'Objetivo: '+String(objective).slice(0,60)+'.',
    'Ángulo de venta: '+(SALES_ANGLES.find(a=>a.id===chosen)?.name||'Demostración')+'. '+focus,
    'Estilo: '+String(tone).slice(0,80)+'.',
    references>0?'Usar la imagen principal para la identidad del producto y las referencias para el encuadre/estilo, sin sustituir la marca ni el envase.':null,
    doc.summary?'Ficha de producto (datos aportados; no inferir propiedades faltantes): '+doc.summary.slice(0,2500):null,
    cta?'Cierre o llamado a la acción: '+String(cta).trim().slice(0,160)+'.':null,
    'Reglas: mantener etiqueta, forma, proporciones y colores del producto. No inventar características, beneficios médicos ni descuentos. Movimiento de cámara realista, buena legibilidad y coherencia visual.',
  ];
  return {angle:chosen,prompt:lines.filter(Boolean).join('\n\n').slice(0,6000),highlights:doc.highlights};
}
