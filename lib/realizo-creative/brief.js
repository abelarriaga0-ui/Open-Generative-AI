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
  // A product dossier can contain entire marketing frameworks and chapters.
  // Only send short, factual product details to the video model, not its index
  // of sections, comparative promises, or a long wall of unreviewed text.
  const normalized=String(text||'').replace(/\r/g,'').replace(/[ \t]+/g,' ').trim().slice(0,16000);
  if(!normalized)return {summary:'',highlights:[]};
  const lineList=normalized.split(/[\n]+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)
    .map(x=>x.trim()).filter(Boolean);
  const noOutline=/^(?:bloque\s+[a-z]\b|\d{1,2}[.)]\s*(?:contexto|arquitectura|diccionario|biblioteca|hooks?|guiones?|checklist|riesgos|mercado|prueba social|faq|avatar|identidad y ficha)|(?:estructura|indice|índice|tabla de contenidos|público objetivo|contexto del mercado|ángulos? de venta)\s*[:.]?$)/i;
  const sections=/^(?:[A-ZÁÉÍÓÚÑ\s\-—]{8,}|\d+\.\s*[\wÁÉÍÓÚÑáéíóúñ\s]+)$/;
  const factWords=/\b(?:nombre|producto|presentaci[oó]n|tama[nñ]o|contenid[oa]|f[oó]rmula|material\w*|ingrediente\w*|composici[oó]n|uso|modo de uso|aplicaci[oó]n|caracter[ií]stica\w*|precauci[oó]n|benefici\w*|fabricado|envase|color|medidas|ml|gramos|g\b)\b/i;
  const facts=[];
  for(const raw of lineList){
    const line=raw.replace(/^\s*[-•]\s*/,'').trim();
    if(line.length<13||line.length>230||noOutline.test(line)||sections.test(line))continue;
    if(!factWords.test(line))continue;
    // Avoid lifting mere headings or lists of questions into sales claims.
    if(/^(?:\d+\.?\s*)?(?:beneficios|ficha t[eé]cnica|identidad del producto|caracter[ií]sticas|ingredientes|modo de uso|producto)\s*$/i.test(line))continue;
    if(!facts.includes(line))facts.push(line);
    if(facts.length>=4)break;
  }
  return {summary:facts.join(' · ').slice(0,610),highlights:facts};
}
export function buildVideoBrief({productName='',description='',documentText='',audience='',objective='ventas',angle='auto',tone='natural',cta='',references=0}={}) {
  const name=String(productName).trim().slice(0,100);
  const desc=String(description).replace(/\s+/g,' ').trim().slice(0,380);
  const doc=summarizeProductDocument(documentText);
  const chosen=angle==='auto'?suggestSalesAngle(name+' '+desc+' '+doc.summary):angle;
  const focus=instructions[chosen]||instructions.demo;
  const lines=[
    'Video publicitario breve de un producto.',
    name?'Producto: '+name+'.':'Mostrar fielmente el producto de la fotografía.',
    desc?'Descripción: '+desc+'.':null,
    audience?'Público: '+String(audience).trim().slice(0,100)+'.':null,
    'Enfoque: '+focus,
    'Estética: '+String(tone).slice(0,65)+'.',
    references>0?'Conservar envase, etiqueta y color del producto de la imagen principal. Usar las demás imágenes solo como inspiración visual.':null,
    doc.summary?'Detalles confirmados en la ficha: '+doc.summary+'.':null,
    cta?'Cierre: '+String(cta).trim().slice(0,100)+'.':null,
    'No inventar características, propiedades, descuentos ni testimonios. Cámara natural, iluminación cuidada y producto reconocible.',
  ];
  return {angle:chosen,prompt:lines.filter(Boolean).join(' ').slice(0,1450),highlights:doc.highlights};
}
