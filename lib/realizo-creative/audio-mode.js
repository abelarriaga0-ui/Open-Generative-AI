// Explicit film audio choice; no speech is NOT the same as a muted video.
// UGC templates keep their existing voice-first behavior.
export const FILM_AUDIO_MODES=Object.freeze(['no_voice','voiceover','dialogue']);
export function normalizeAudioMode(value){
  return FILM_AUDIO_MODES.includes(value)?value:'no_voice';
}
export function filmAudioValid(audioMode,castMode){
  return FILM_AUDIO_MODES.includes(audioMode) &&
    !(audioMode==='dialogue'&&castMode==='product_only');
}
export function filmAudioDirection(audioMode,castMode,language='es',script=''){
  const mode=normalizeAudioMode(audioMode);
  if(!filmAudioValid(mode,castMode))throw new Error('premium_audio_cast_conflict');
  if(mode==='no_voice')return [
    'ABSOLUTE NO-VOICE AUDIO LOCK: Zero spoken words, narration, voiceovers,',
    'dialogue, singing, chants, vocal samples, synthetic speech or human voices',
    'in any second. Audio should contain only original instrumental cinematic music,',
    'tactile product foley and tasteful ambient effects. Do not generate subtitles',
    'or speech captions. Never interpret the research spoken_script as narration.'
  ].join(' ');
  const words=String(script||'').trim().slice(0,650);
  if(!words)throw new Error('premium_audio_script_required');
  if(mode==='voiceover')return [
    'MANDATORY NARRATION MODE: Include a clear, short, professional OFF-SCREEN',
    'voiceover in language '+language+'. There are NO speaking people on screen.',
    'This is NOT a presenter or UGC testimonial. Deliver only the approved words',
    'with natural cinematic timing, professional vocal production and original',
    'music/foley mixed beneath the narrator. Approved narration: "'+words+'".'
  ].join(' ');
  return [
    'MANDATORY ON-SCENE DIALOGUE MODE: Adult actors who are naturally present',
    'speak a brief believable exchange to EACH OTHER in language '+language+'.',
    'The speech must be audible and fit the '+language+' pacing of the film.',
    'Professional production sound and credible lips synchronized to the voices',
    'where supported. Nobody addresses the viewer or talks directly to camera;',
    'no selfie or review. Use this approved dialogue copy as the spoken content:',
    '"'+words+'". Never fabricate product claims.'
  ].join(' ');
}
