import {hmacHex, nowSeconds} from '../realizo-auth/crypto.js';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MEDIA_LIFETIME = 2 * 24 * 3600;
const validMimes = Object.freeze(['image/jpeg','image/png','image/webp']);

export function sniffImageMime(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return null;
  if(bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'image/jpeg';
  if(bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47 &&
     bytes[4]===0x0d && bytes[5]===0x0a && bytes[6]===0x1a && bytes[7]===0x0a) return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'image/webp';
  return null;
}
export async function mediaSignature(pepper,id,expiry) {
  return hmacHex(pepper,'realizo:media:v1:'+id+':'+expiry);
}
export async function signedMediaUrl(env,id,expiry) {
  const signature=await mediaSignature(env.REALIZO_AUTH_PEPPER,id,expiry);
  const base=String(env.REALIZO_AUTH_ORIGIN||'').replace(/\/$/,'');
  return base+'/api/realizo/media/'+encodeURIComponent(id)+'?expires='+expiry+'&sig='+signature;
}
export function allowedUpload(file) {
  return Boolean(file && validMimes.includes(file.type) && file.size>=100 && file.size<=MAX_IMAGE_BYTES);
}
export function canReadSignedMedia(expires) {
  return Number.isSafeInteger(expires) && expires>nowSeconds() && expires<=nowSeconds()+MEDIA_LIFETIME;
}
