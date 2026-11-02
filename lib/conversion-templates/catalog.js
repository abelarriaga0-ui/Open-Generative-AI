// Catálogo privado de plantillas autorizadas. Nunca aceptar instrucciones de plantilla del cliente.
import explosionPremium from './explosion-premium-azul.json';

export const CONVERSION_TEMPLATES = Object.freeze([explosionPremium]);

export function findConversionTemplate(id) {
  return CONVERSION_TEMPLATES.find((item) => item.id === id) || null;
}

export function buildStrictTemplatePrompt(template) {
  return [
    'TAREA: EDICIÓN DE UNA PLANTILLA PUBLICITARIA EXISTENTE. NO RECREAR UN DISEÑO NUEVO.',
    'Imagen de referencia A (primera imagen): la PLANTILLA MAESTRA, obliga a conservar el diseño.',
    'Imagen de referencia B (segunda imagen): el ÚNICO PRODUCTO NUEVO que debe sustituir al envase central de A.',
    'MODIFICACIÓN ÚNICA: reemplazar físicamente el recipiente principal de A por el producto de B.',
    'Fidelidad máxima: conservar el encuadre vertical, perspectiva, ubicación, tamaño aparente y capas de profundidad.',
    'No mover, redibujar, eliminar ni regenerar la atleta, ni cambiar su rostro, ropa, pose o shaker.',
    'Mantener píxel a píxel donde sea posible el fondo azul, la iluminación general, salpicaduras, vainilla, flores y hojas.',
    'Conservar la tipografía blanca, sus letras, su orientación, todo el texto y la posición de cada elemento.',
    'Elementos visuales protegidos: ' + template.lockedVisuals.join('; ') + '.',
    'Colocar el producto B dentro de la zona central aproximada x=' +
      template.productSlot.x + ', y=' + template.productSlot.y +
      ', ancho=' + template.productSlot.width + ', alto=' + template.productSlot.height +
      ' (coordenadas relativas).',
    'Reproducir exactamente la forma, etiqueta, marca, logotipo, colores y proporciones del producto B.',
    'No reutilizar marca, logo ni empaque del producto A, no crear un segundo producto, no inventar ingredientes.',
    'Solo se autorizan cambios locales de sombras, reflejos y escala para integrar físicamente el producto B.',
    'Si una región de la plantilla queda tapada por el envase nuevo, respetar sus oclusiones y capas originales.',
    'NO crear fondos alternativos, no reencuadrar, no añadir texto, iconos, precios, personas ni objetos.',
    'El resultado debe parecer la MISMA imagen publicitaria de A con un único cambio: el producto central.',
    'Prioridad de las instrucciones: referencia A para todo el anuncio; referencia B solamente para identidad de producto.'
  ].join('\n');
}

export function isSafePublicImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host === 'metadata.google.internal') return false;
    return true;
  } catch { return false; }
}
