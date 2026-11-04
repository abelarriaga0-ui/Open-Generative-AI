// Model-agnostic director: performance, physical realism and per-second
// commercial choreography. Prompts guide stochastic generators, not a video
// editor or a guarantee of exact frames/native speech.
import {buyerIntent,salesBeatPlan} from './sales-storyboard.js';
import {selectedStyle} from './format-guides.js';

const safe=(v,n=220)=>String(v||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const segments=(s)=>s==='ugc'||s==='demo';
export const HYPERREAL_COMMERCIAL_VERSION='realizo-hyperreal-director-v1';

function environment(info){
 const source=safe(info.sellerDescription||info.description,800).toLowerCase();
 const motive=safe(info.buyerMotive||info.angle,160).toLowerCase();
 const combined=source+' '+motive;
 const intent=buyerIntent(source);
 if(intent.socialScent||/fragancia|perfume|esencia|aroma|perfumed|cologne/.test(combined))
  return {location:'lived-in apartment dressing area near a mirror, realistic doorway visible',wardrobe:'charcoal cotton shirt with subtle fabric creases',light:'warm-neutral practical hallway lamp 3500K plus soft window spill; real shadow falloff',action:'notices the missing final scent step while checking a shirt collar',prop:'sets down his keys, opens or applies the actual fragrance only if seller instructions support it'};
 if(intent.bodyStriae||/crema|serum|piel|hidrat|skincare|locion|loción/.test(combined))
  return {location:'ordinary clean home bathroom with slightly imperfect towels and matte tile',wardrobe:'muted sand-colored everyday cotton top',light:'diffuse daytime window at roughly 4800K, natural soft shadow, neutral skin color',action:'notices the real skin-care need while preparing their routine, without displaying invented transformations',prop:'opens the real product and demonstrates only the verified application steps'};
 if(/caspa|cabello|shampoo|champú|cuero cabelludo|barba|pelo/.test(combined))
  return {location:'realistic bathroom vanity with mirror and damp everyday details',wardrobe:'plain slate-blue casual shirt',light:'soft daylight balanced about 4700K with believable bathroom bounce',action:'checks hair or scalp naturally in mirror without staged exaggerated distress',prop:'takes the correct container, then uses it only as seller/product data permits'};
 if(/hogar|cocina|limp|utensil|electrodom|mopa/.test(combined))
  return {location:'believable lived-in kitchen or home work surface, not a synthetic showroom',wardrobe:'muted navy casual workwear',light:'large diffuse window 5100K with natural occlusion and environmental reflections',action:'encounters the precise practical household frustration described by the sales angle',prop:'places the product on the actual work surface and shows a mechanically correct step'};
 if(/tecnol|cargador|celular|pantalla|dispositivo|gadg|electr/.test(combined))
  return {location:'ordinary desk or working area with coherent device cables and small everyday objects',wardrobe:'neutral graphite casual clothes',light:'natural mixed desk-and-window light around 4500K without neon sci-fi highlights',action:'shows the practical inconvenience through a believable hand movement',prop:'connects or uses the device according to its verified ports, orientation and operation'};
 return {location:'authentic daily-use environment chosen to fit the actual buyer problem, not a generic luxury set',wardrobe:'simple matte natural-fiber neutral clothing appropriate to the product',light:'motivated practical light, plausible 4000–5000K color temperature and contact shadows',action:'physically reacts to the specific consumer need, not an exaggerated theatrical surprise',prop:'handles the real item at correct scale and demonstrates only the known use'};
}

function taskForBeat(style,beat,env,info){
 const name=beat.name.toUpperCase();
 const product=safe(info.product||info.productName,75)||'the real product';
 if(name.includes('HOOK'))
  return style==='premium'
   ?'Open at frame zero on a tactile, truthful product-use detail with a surprising physical movement; product identity recognizable, no empty intro.'
   :style==='cinematic'
   ?'Open in the middle of a motivated human action with a visible desire/conflict; face reacts subtly before the cut, not a silent establishing shot.'
   :style==='demo'
   ?'Show the practical failure or unmet need immediately in an honest close view; a hand tries the ordinary task, with specific credible resistance.'
   :'Start speaking the EXACT first hook words at frame zero to lens; '+env.action+'; small eyebrow reaction, natural glance and a single purposeful gesture, no greeting.';
 if(name.includes('PROBLEMA')||name.includes('DESEO Y CONTEXTO'))
  return 'Show the real consequence or desire: eyes briefly refocus toward the relevant object, hand reacts with realistic inertia, one clear cause-and-effect action; no theatrical overacting.';
 if(name.includes('SOLUCIÓN'))
  return 'Visually resolve the friction before merely listing the item: deliberate reach, correct direction of movement, physically possible grip and immediate explanation of the solution.';
 if(name.includes('PRODUCTO'))
  return 'Reveal '+product+' during the spoken mention or narrative turn, with its actual label, colors, cap and proportions matching the reference; show a motivated hand-to-product interaction, no floating packshot.';
 if(name.includes('USO')||name.includes('ESCENA'))
  return 'Demonstrate '+env.prop+'; keep hands and product in-frame long enough to understand the exact action, no false results or teleporting objects.';
 if(name.includes('BENEFICIO')||name.includes('IMPACTO')||name.includes('DETALLE'))
  return 'Show one observably supported value through an authentic micro-action: contact, material response, functional detail, credible after-state; no magical before/after.';
 return style==='cinematic'||style==='premium'
  ?'End on a clear product-led visual purchase cue and composed hero view without fabricated readable overlay text.'
  :'Turn back toward viewer or return to a legible product-use composition; deliver the exact spoken buying CTA clearly through the last second, no mute fade.';
}

function oneSecondDirection(style,seconds,beats,env,info,hasSpeech){
 const span=Math.max(1,Math.min(120,Math.round(Number(seconds)||8)));
 const output=[];
 const increment=span>45?Math.ceil(span/24):1;
 for(let t=0;t<span;t+=increment){
  const beat=beats.find((b,i)=>t>=b.start && (t<b.end||i===beats.length-1))||beats.at(-1);
  const elapsed=t-beat.start;
  const first=elapsed<1;
  let cue;
  if(first)cue=taskForBeat(style,beat,env,info);
  else if((t%3)===0)cue='Advance the same physical action; consistent grip and position; cut only on gesture.';
  else if((t%3)===1)cue='Natural micro-expression, blink and breath; no posing, no frozen body.';
  else cue='Continue perspective, eyeline and real lighting; show meaningful change.';

  output.push(t+'–'+Math.min(span,t+increment)+'s '+cue);
 }
 return output.join(' ');
}
export function buildHyperrealCommercialDirection(info={}){
 const style=selectedStyle(info.style,'ugc');
 const duration=Math.max(1,Math.min(120,Number(info.duration)||12));
 const env=environment(info);
 const beats=Array.isArray(info.salesBeats)&&info.salesBeats.length?info.salesBeats:salesBeatPlan(duration,style,info.angle);
 const hasSpeech=(segments(style)||info.audioMode!=='no_voice')&&Boolean(safe(info.voice||info.spoken_script,3200));
 const renderSeconds=Math.round(duration);
 const timeline=oneSecondDirection(style,duration,beats,env,info,hasSpeech);
 const camera=style==='ugc'
  ?'Handheld phone-height eye-level 28–35mm-equivalent perspective, slight imperfect wrist drift; 70–85% on-face speaking coverage, natural unretouched pores; one restrained insert while the same voice continues.'
  :style==='demo'
  ?'Real demonstration camera at chest/worktop height, 40–55mm-equivalent for hands/action and one close insert only when needed; no wide beauty-shot hiding a step.'
  :style==='cinematic'
  ?'Narrative 35–50mm-equivalent lens and motivated shoulder/dolly travel only when action requires; maintain consistent eyeline, 180-degree screen direction and real focus breathing.'
  :'Physically plausible 65–90mm macro/portrait optical feel and controlled studio-like but motivated reflections; preserve complete product scale and edges, avoid endless drifting macro shots.';
 const acting=style==='ugc'
  ?'Adult speaker acts like an actual person explaining a useful discovery, directly to ONE buyer: conversational facial muscles, tiny asymmetric smile, restrained brow change when revealing solution, genuine short breaths and clear rapid articulation. Avoid forced influencer excitement.'
  :style==='demo'
  ?'Hands perform observable, anatomically correct grip and mechanism steps. If actor present, only realistic reactions to the task; product operation—not posing—is the story.'
  :style==='cinematic'
  ?'Actor reveals motive with eyes and body micro-behavior, no theatrical perfume-ad staring: glance, decisive reach, responsive posture, relaxed jaw; each cut changes the story.'
  :'If people were selected, adult model uses the item with subtle believable movements and realistic material contact; if product-only, absolutely no human parts, reflections or skin.';
 const audio=hasSpeech
  ?'SPOKEN PERFORMANCE: first phoneme within 0–0.2s, clear human cadence; micro-breaths only, no dramatic pause or empty insert, voice persists across shot transitions, CTA finishes by final 0.2s. Preserve the authorized words and language exactly; lips synchronize only where the model supports native audio.'
  :'SOUND CONTRACT: no spoken dialogue is requested. Use real matching foley and restrained original music with editing energy; keep each second visually informative. Do not invent voices.';
 const continuity='CONTINUITY LOCK: one actor identity, same face bone structure, ears, hairstyle, skin texture, wardrobe and accessories; same product container proportions, logo placement, lid, materials, hand scale; same room geometry, prop positions, practical lighting direction and screen direction across all shots. Never change outfit or scene chronology mid-routine. The uploaded product photo is an identity reference only when the model supports that input role.';
 const photoreal='REAL PHYSICAL PHOTOGRAPHY: physically motivated shadows and bounce, subsurface skin texture without plastic smoothing, visible peach fuzz only when optically plausible, authentic iris highlights and irregular blinks, teeth and lips stable, exact finger count and natural knuckle tension; fabric creases follow body motion; gravity governs liquids, drops and wrist motion. Optics have honest lens perspective, appropriate motion blur, shallow depth of field only when focus allows, slight natural sensor noise, restrained color grade; no CGI gloss, face drift, morphing bottle, impossible cuts, artificial flare, auto-spelling or fake subtitles.';
 const context='REAL SET: '+env.location+'. '+(info.castMode==='product_only'?'CAST: physical item and nonhuman props ONLY. ':'WARDROBE: '+env.wardrobe+'. ')+'LIGHT: '+env.light+'. CAMERA: '+camera+' PERFORMANCE: '+acting;
 const sales='COMMERCIAL CONTRACT: actual angle '+safe(info.angle,110)+'; buyer motive '+safe(info.buyerMotive,180)+'. Hook is a visible event synchronized with the first spoken words when there is speech. Establish real friction/desire, show solution, introduce product early at the correct verbal moment, demonstrate a specific verified use/benefit, end with a buying CTA. Product recognizable early, ideally within 0–4s as a real grounded object in the scene; make the primary reveal precisely when the speech introduces it, never hide it until the final third. Different products require different gestures, blocking, lighting and visual choices; do NOT reuse a perfume preparation scene for an unrelated item.';
 return [
  HYPERREAL_COMMERCIAL_VERSION,context,continuity,photoreal,sales,audio,
  'ONE-SECOND DIRECTOR TIMELINE ('+renderSeconds+'s): '+timeline
 ].join(' ');
}

// Instructions for the research LLM: it must supply the complete filmed
// choreography, but retain distinct styles and angles instead of one template.
export function researchHyperrealDirection({seconds=30,style='auto'}={}){
 const duration=Math.max(1,Math.min(120,Number(seconds)||30));
 return 'HYPERREAL VISUAL DIRECTOR CONTRACT for '+duration+'s, style '+safe(style,20)+': for EACH of the three concepts specify distinct buyer-triggered first-frame ACTION, precise adult actor demeanor/gesture and micro-expression (when people allowed), motivated room/wardrobe colors, practical light source and approximate warm/cool color temperature, realistic lens/framing/hand-held or dolly movement, product grip/use, prop positions, cut motivation, and SOUND synchronized to semantic beats. Write a second-by-second action progression inside video_prompt and meaningful timed shots; avoid generic interchangeable elegance. UGC: person talks to lens with continuous natural voice. DEMO: practical problem, exact mechanics and the real observable use dominate; do not write a perfume-fashion montage as a demo. CINEMATIC: story with motivated action and resolved desire, not repeated bottle closeups. PREMIUM: real physical material/value, believable aspirational context, hero product and purchase motive. Lock SAME actor, clothing, container and spatial light through every moment. Hook immediately, solution and product timely, CTA at closing. Visual actions match spoken_script phrase by phrase and cannot describe the source photograph. All claimed product effects need seller/evidence support; leave unknown facts out, not warnings inside the ad. Prefer feasible 2–6 shots with continuity over flashy incoherent cuts. A prompt is instruction, not proof of native audio or exact model compliance.';
}
