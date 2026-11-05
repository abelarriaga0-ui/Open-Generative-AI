// Cross-product direction layer: commercial motive decides WHAT happens;
// UGC, Premium, Cine or Demo decides HOW it is filmed. Never hard-code an SKU.
import {salesAngleDirective} from './sales-angle.js';

const VISUAL_MOTIVES=Object.freeze({
  seduction:{
    with_people:'Tell a conspicuously sensual ADULT attraction story, not merely an elegant product montage: intentional flirtatious glances, intimate but non-explicit proximity, adult body language, attractive styling (including suggestive wardrobe when appropriate to the product and audience), a visible reciprocal emotional reaction and a coherent moment of chemistry. Stage adult reactions as storytelling, NEVER claim a product guarantees another person\'s attraction or consent.',
    product_only:'Convey a bold sensual mood through suggestive fabric, sensuous material lighting, close optical detail and seductive color/texture. Do not introduce people when product-only was chosen.',
  },
  health:{
    with_people:'Show a credible adult care need followed by an authentic supported routine or use, with empathetic human expression and practical context. No imaginary diagnosis, cure, clinical effect or guaranteed result.',
    product_only:'Stage genuine care, clear usage information and trustworthy product detail without simulated medical outcomes.',
  },
  beauty:{
    with_people:'Make the appearance and personal-expression desire visible through adult styling, authentic grooming or beauty application where relevant, natural texture and a satisfying finished look. Do not fabricate dramatic before-after transformations.',
    product_only:'Emphasize true textures, shades, design and styling potential with physically realistic product detail.',
  },
  wellness:{
    with_people:'Stage a grounded adult self-care moment with deliberate sensory cues, relief of daily stress suggested by expression and unhurried comfortable motion; do not imply unverified therapeutic effects.',
    product_only:'Use tactile, comforting light and a truthful sensory use context; no clinical promises.',
  },
  confidence:{
    with_people:'Show a distinct adult self-presentation or empowerment moment: decisive posture, eye contact, purposeful movement and a believable social or professional setting. Make the feeling of confidence visible.',
    product_only:'Use bold but truthful product presentation that conveys deliberate personal choice and confidence.',
  },
  comfort:{
    with_people:'Open with a recognizable practical inconvenience and show a credible smoother daily interaction with the product. Focus on observed ease, not unverified pain relief.',
    product_only:'Show practical use, ergonomics and visibly accessible product details rather than a disconnected packshot.',
  },
  savings:{
    with_people:'Stage a tangible value-for-money or practical efficiency decision; only show prices, discounts or numeric comparisons if explicitly supported. Make the choice understandable without inventing money saved.',
    product_only:'Reveal actual quantity, pack contents or features that explain value; never create fictional price labels.',
  },
  security:{
    with_people:'Show grounded, responsible handling and a credible sense of preparedness in a relevant setting. Do not dramatize unverified protective guarantees.',
    product_only:'Show robust, verified protective details or thoughtful construction only where the product actually has them.',
  },
  performance:{
    with_people:'Build the scene around a specific observable action, a realistic task and a credible demonstration of what the product does. Avoid exaggerated or fabricated measured results.',
    product_only:'Show real operational features, interfaces or mechanics with convincing physical motion and continuity.',
  },
  gifting:{
    with_people:'Tell a small believable gifting story: genuine anticipation, a thoughtful handover and a meaningful adult reaction, adapted to the selected product and context.',
    product_only:'Build a tasteful gifting reveal with authentic packaging, an occasion cue and a clear product hero.',
  },
  problem:{
    with_people:'Make a concrete everyday problem visible immediately and demonstrate a supported product-use solution; avoid generic abstract suffering.',
    product_only:'Visualize the concrete task and authentic product mechanism behind the solution.',
  },
  benefits:{
    with_people:'Show one specific verified practical benefit through actual product use and a human outcome that is observable rather than promised.',
    product_only:'Demonstrate the product\'s real functional advantage through camera, motion and physical detail.',
  },
  sensory:{
    with_people:'Make the selected sensory experience tangible with realistic gestures, texture, lighting, sound and a plausible human response.',
    product_only:'Create rich truthful sensory shots of material, texture, movement and light.',
  },
  offer:{
    with_people:'Stage a decisive buying moment with the seller-confirmed offer only; show an authentic reason to act without invented scarcity.',
    product_only:'Display verified pack contents or offer elements with no fabricated prices or extra goods.',
  },
  lifestyle:{
    with_people:'Connect product use to a credible lifestyle activity and adult aspiration that is appropriate to the market and product.',
    product_only:'Use an appropriate setting and genuine product context, not a neutral isolated packshot.',
  },
});
const DEFAULT_MOTIVE={
  with_people:'Create a specific adult human action that embodies the researched buyer motive, with a visible change or response that makes the advertising idea unmistakable. Do not substitute generic beauty poses or a studio packshot.',
  product_only:'Show the researched buyer motive using only truthful product interactions, materials, and relevant nonhuman props; no bodies or hands.',
};
const compact=(value,max=300)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
export function angleDirectionContract({salesAngle='auto',requestedSalesAngle='',castMode='with_people',buyerMotive='',hook='',creativeStyle='auto',compactMode=false}={}){
 const code=String(salesAngle||'auto').split(':')[0];
 const cast=castMode==='product_only'?'product_only':'with_people';
 const guide=(VISUAL_MOTIVES[code]||DEFAULT_MOTIVE)[cast]||DEFAULT_MOTIVE[cast];
 const chosen=compact(requestedSalesAngle||salesAngleDirective(salesAngle),240);
 const motive=compact(buyerMotive,260);
 const firstBeat=compact(hook,110);
 if(compactMode)return 'P0 / UNIVERSAL BUYER-ANGLE VISUAL CONTRACT: '+(chosen||'research-derived buyer motive')+'. VISUAL BEHAVIOR: '+compact(guide,220)+'. MOTIVE: '+compact(motive,110)+'. FORMAT '+compact(creativeStyle,24)+' changes filmmaking, NOT the chosen story. Preserve adult/physical realism and verifiable effects.';
 return [
  'P0 / UNIVERSAL BUYER-ANGLE VISUAL CONTRACT (PRIMARY STORY, not decorative styling).',
  'BUYER ANGLE: '+(chosen||'Research-derived motive; no preset SKU or generic interchangeable imagery')+'.',
  'VISUAL BEHAVIOR: '+guide,
  motive?'BUYER DESIRE TO EXPRESS ONSCREEN: '+motive+'.':'',
  firstBeat?'FIRST-FRAME STORY HOOK: '+firstBeat+'.':'',
  'The selected creative FORMAT '+compact(creativeStyle,24)+' governs camera, editing and finish ONLY. It must NOT replace or neutralize the sales angle.',
  'Make the angle unmistakable through concrete actions, cast blocking, wardrobe/props when applicable, emotion and reaction, not just a label in the prompt. The product remains accurately recognizable and relevant to the story.',
  'The angle must fit the actual category, culture, market and chosen cast. No invented product effects, implied medical promises, false testimonials, nonconsensual behavior or explicit nudity.',
 ].filter(Boolean).join(' ');
}
export function conceptSceneContract({videoPrompt='',shotIdeas=[],hook='',buyerMotive='',duration=8,compactMode=false}={}){
 const brief=compact(videoPrompt,1800);
 const shots=Array.isArray(shotIdeas)?shotIdeas.map(s=>compact(s,260)).filter(Boolean).slice(0,8):[];
 if(compactMode)return 'P0 / APPROVED CONCEPT STORYBOARD: HOOK '+compact(hook,100)+'. MOTIVE '+compact(buyerMotive,120)+'. PRIMARY FILMED EVENTS: '+compact(brief,300)+'. The selected events must be visible, not replaced by neutral packshots.';
 return [
  'P0 / APPROVED CONCEPT STORYBOARD — REPRODUCE THE SELECTED IDEA, NOT A GENERIC REPLACEMENT.',
  hook?'HOOK: '+compact(hook,115)+'.':'',
  buyerMotive?'MOTIVATION: '+compact(buyerMotive,260)+'.':'',
  brief?'PRIMARY FILMED EVENTS: '+brief+'.':'',
  shots.length?'RESEARCHED SHOT ACTIONS, ORDER PRESERVED: '+shots.map((s,i)=>'('+String(i+1)+') '+s).join(' | ')+'.':'',
  'Stage feasible action over '+Math.max(1,Math.min(120,Number(duration)||8))+' seconds; adapt pacing and shot count to model constraints without erasing the defining action, participants or buyer-angle reaction. Prioritize actual scenario over repeated generic bottle/product macros.',
 ].filter(Boolean).join(' ');
}
