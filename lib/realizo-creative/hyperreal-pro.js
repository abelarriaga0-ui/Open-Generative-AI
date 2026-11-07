// Realizo Hiperrealista PRO: isolated prompt planner, no billing or provider side effects.
// Multi-shot instructions are advisory: a single video model may not honor every cut.
export const HYPERREAL_PRO_VERSION = 'realizo-hyperreal-pro-v1';
const DURATIONS = new Set([15, 30, 45]);
const clean = (value, max) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  : '';
export function normalizeHyperrealProBrief(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('invalid_hyperreal_brief');
  const duration = Number(raw.duration);
  if (!DURATIONS.has(duration)) throw Error('unsupported_hyperreal_duration');
  const product = clean(raw.product_name, 90);
  const description = clean(raw.description, 400);
  if (!product || !description) throw Error('product_details_required');
  const format = raw.format === '16:9' ? '16:9' : '9:16';
  const speak = raw.speak !== false;
  return {
    product_name: product,
    description,
    audience: clean(raw.audience, 150) || 'personas interesadas en el producto',
    angle: clean(raw.angle, 250) || 'presentar el producto de forma auténtica y convincente',
    actor: clean(raw.actor, 220) || 'una misma persona adulta con aspecto cotidiano',
    location: clean(raw.location, 170) || 'un espacio real y habitado, con luz natural',
    cta: clean(raw.cta, 100) || 'Escríbenos para conocer más',
    spoken_script: clean(raw.spoken_script, 900),
    duration,
    format,
    speak
  };
}
const BEATS = [
  ['Gancho humano', 'Abrir con un gesto espontáneo y un motivo de interés perceptible en el rostro, nunca una pose de catálogo.'],
  ['Situación real', 'Mostrar una acción cotidiana y el contexto del comprador.'],
  ['Presentación', 'La persona sostiene el producto y su etiqueta es reconocible.'],
  ['Uso auténtico', 'Demostrar solamente una acción de uso compatible con lo declarado por el cliente.'],
  ['Detalle y reacción', 'Primer plano breve del envase real, reflejos naturales y reacción humana sutil.'],
  ['Cierre y acción', 'Regresar al rostro y al producto; llamada a la acción natural y verificable.']
];
export function planHyperrealProScenes(brief) {
  const b = normalizeHyperrealProBrief(brief);
  const count = b.duration / 5;
  return Array.from({length: count}, (_, index) => {
    const beat = index === count - 1 ? BEATS[5] : BEATS[index % 5];
    return {
      number: index + 1, start: index * 5, end: (index + 1) * 5,
      title: beat[0], action: beat[1],
      camera: index % 3 === 0 ? 'handheld de teléfono, movimiento mínimo' :
        index % 3 === 1 ? 'plano medio natural, profundidad de campo creíble' :
        'primer plano óptico con micro movimiento'
    };
  });
}
export function buildHyperrealProVideoPrompt(raw) {
  const b = normalizeHyperrealProBrief(raw);
  const shots = planHyperrealProScenes(b);
  const audio = b.speak
    ? 'SPEECH: the SAME adult presenter speaks directly to camera in natural Latin American Spanish, with authentic breathing, unforced intonation, accurate lip movements if the model supports native speech. ' +
      (b.spoken_script
        ? 'Use this supplied dialogue exactly, without inventing claims: ' + JSON.stringify(b.spoken_script) + '.'
        : 'Spoken information may ONLY describe the product using the verified supplied details. Mention ' +
          JSON.stringify(b.product_name) + ' and ' + JSON.stringify(b.description) +
          ', conclude with ' + JSON.stringify(b.cta) + '. No fabricated experience or testimonial.')
    : 'AUDIO: no speech, no voiceover and no visible talking; only unobtrusive realistic environmental sound if supported.';
  return [
    'REALIZO HIPERREALISTA PRO | ' + b.duration + ' SECONDS | ' + b.format + ' | coherent multi-shot commercial.',
    'PRODUCT, only approved evidence: ' + JSON.stringify(b.product_name) + '. ' + JSON.stringify(b.description) + '.',
    'USER SALES INTENT: ' + JSON.stringify(b.angle) + '. AUDIENCE: ' + JSON.stringify(b.audience) + '.',
    'CONSISTENCY LOCK: Same exact adult actor in every shot: ' + JSON.stringify(b.actor) + '. Same age, face, hair, skin texture, clothing, hands, voice and body proportions. One consistent physical product; never alter bottle shape, label, brand, logo, cap, size or colors from the reference PHOTO.',
    'SETTING: ' + JSON.stringify(b.location) + '. Maintain matching environment, continuity of wardrobe, lighting and placement across cuts.',
    'PHYSICAL REALISM: genuine smartphone footage, non-perfect framing, visible organic skin texture, credible pores and hair, natural blinking and eye focus, believable teeth, microexpressions, real gravity, realistic grip on the packaging, no waxy skin, no glossy CGI, no morphing, no extra fingers, no teleporting props.',
    'SHOT TIMELINE (real cuts, not dissolves or morph transitions): ' +
      shots.map(s => s.start + '-' + s.end + 's / ' + s.title + ': ' + s.action + ' Camera: ' + s.camera + '.').join(' '),
    audio,
    'Do not claim proven benefits, medical outcomes, approvals, scarcity, research findings, conversions or endorsements absent from supplied evidence. No watermarks. No randomly generated captions or packaging text.',
    'IMPORTANT: A reference-image model should use uploaded photo as the identity reference, NOT as an obligatory first video frame. Every scene must be photographically coherent. When cuts cannot be honored, prefer identity and physical realism over artificial transitions.'
  ].join('\n');
}
