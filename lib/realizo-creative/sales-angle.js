// Customer buying motivation (the WHAT/WHY), independent from video format (the HOW).
// Keep historic codes for existing templates and saved projects.
export const SALES_ANGLE_CHOICES=Object.freeze([
 ['auto','Que la IA investigue y elija'],
 ['seduction','Sexy / seducción'],
 ['health','Salud'],
 ['beauty','Belleza'],
 ['wellness','Bienestar'],
 ['confidence','Confianza personal'],
 ['comfort','Comodidad'],
 ['savings','Ahorro'],
 ['security','Seguridad'],
 ['performance','Rendimiento'],
 ['gifting','Regalo'],
 ['custom','Ángulo libre (escribir el mío)'],
]);
const OLD_CODES=['problem','premium','benefits','sensory','demo','ugc','offer','lifestyle'];
export const ANGLES=Object.freeze([...SALES_ANGLE_CHOICES.map(([id])=>id),...OLD_CODES]);
const MOTIVES=Object.freeze({
 seduction:'Sexy / seducción: atractivo y primera impresión, sin garantizar atracción de otras personas',
 health:'Salud: necesidades de cuidado y salud respaldadas por el producto, sin prometer curación',
 beauty:'Belleza: apariencia, imagen personal y cuidado estético verificable',
 wellness:'Bienestar: sentirse bien, autocuidado y comodidad cotidiana',
 confidence:'Confianza personal: seguridad al presentarse y desenvolverse',
 comfort:'Comodidad: reducir molestias cotidianas mediante usos reales',
 savings:'Ahorro: aprovechar recursos o gastos comprobables, sin inventar descuentos',
 security:'Seguridad: tranquilidad y protección solo cuando están fundamentadas',
 performance:'Rendimiento: eficacia práctica y desempeño demostrable',
 gifting:'Regalo: valor de obsequiar y ocasión especial',
 problem:'Problema y solución sustentados',premium:'Exclusividad y lujo sin inventar propiedades',
 benefits:'Beneficio directo verificable',sensory:'Sensaciones y emoción realistas',
 demo:'Funcionalidad comprobable',ugc:'Experiencia cercana sin testimonios falsos',
 offer:'Oferta solo si el vendedor confirmó sus condiciones',lifestyle:'Estilo de vida',
});
// Store the exact custom direction in the existing sales_angle column.
// This avoids database migrations and keeps the user's earlier paid research intact.
export function normalizeSalesAngle(value,customValue=''){
 const code=String(value??'auto').trim();
 if(!ANGLES.includes(code))return null;
 if(code!=='custom')return code;
 if(typeof customValue!=='string')return null;
 const phrase=customValue.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
 if(phrase.length<8||phrase.length>240)return null;
 return 'custom:'+phrase;
}
export function salesAngleDirective(stored){
 const value=String(stored||'auto');
 if(value==='auto')return '';
 if(value.startsWith('custom:')){
  const phrase=value.slice('custom:'.length).trim();
  return phrase.length>=8&&phrase.length<=240?phrase:'';
 }
 return MOTIVES[value]||'';
}
export function hasChosenSalesAngle(stored){
 return Boolean(salesAngleDirective(stored));
}
