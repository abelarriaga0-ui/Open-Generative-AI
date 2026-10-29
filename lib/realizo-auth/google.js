import { assertOwnAuthConfig, nowSeconds, randomToken, sha256 } from './crypto.js';
const cookie = '__Host-realizo_oauth';
const cookieOpts = { httpOnly:true, secure:true, sameSite:'lax',path:'/',maxAge:600 };
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function decode64(segment) {
  const raw=atob(segment.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(segment.length/4)*4,'='));
  return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
export function googleEnabled(env) {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}
export async function beginGoogle(env,response) {
  assertOwnAuthConfig(env);
  if(!googleEnabled(env)) throw new Error('google_oauth_not_configured');
  const state=randomToken(), nonce=randomToken(), verifier=randomToken();
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  const challenge=base64url(new Uint8Array(digest));
  await env.WALLETS_DB.prepare(
    'INSERT INTO realizo_oauth_states (state_hash,code_verifier,nonce,expires_at) VALUES (?,?,?,?)'
  ).bind(await sha256(state),verifier,nonce,nowSeconds()+600).run();
  const params=new URLSearchParams({
    client_id:env.GOOGLE_OAUTH_CLIENT_ID,redirect_uri:env.REALIZO_AUTH_ORIGIN+'/auth/google/callback',
    response_type:'code',scope:'openid email profile',state,nonce,
    code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account',
  });
  response.headers.set('Location','https://accounts.google.com/o/oauth2/v2/auth?'+params);
  response.cookies.set(cookie,state,cookieOpts);
  return response;
}
export async function verifyGoogleIdToken(token,clientId,nonce) {
  if(typeof token!=='string' || token.length>12000 || !/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token)) return null;
  try {
    const parts=token.split('.');
    const header=JSON.parse(new TextDecoder().decode(decode64(parts[0])));
    const payload=JSON.parse(new TextDecoder().decode(decode64(parts[1])));
    const now=nowSeconds();
    if(header.alg!=='RS256' || !header.kid || !['https://accounts.google.com','accounts.google.com'].includes(payload.iss) ||
       payload.aud!==clientId || payload.nonce!==nonce || payload.email_verified!==true ||
       typeof payload.sub!=='string' || !/^\d{6,40}$/.test(payload.sub) ||
       typeof payload.exp!=='number' || payload.exp<=now || payload.iat>now+60 ||
       typeof payload.email!=='string') return null;
    const jwkResponse=await fetch('https://www.googleapis.com/oauth2/v3/certs', {cache:'no-store'});
    if(!jwkResponse.ok) return null;
    const jwks=await jwkResponse.json();
    const key=jwks.keys?.find(k=>k.kid===header.kid && k.kty==='RSA' && k.alg==='RS256');
    if(!key) return null;
    const publicKey=await crypto.subtle.importKey('jwk',key,
      {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',publicKey,
      decode64(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
    return valid ? {email:payload.email,subject:payload.sub} : null;
  }catch {return null;}
}
export async function finishGoogle(env,request) {
  assertOwnAuthConfig(env);
  if(!googleEnabled(env)) return null;
  const params=new URL(request.url).searchParams;
  const state=params.get('state'),code=params.get('code');
  const expected=request.cookies.get(cookie)?.value;
  if(!state || !code || !expected || state!==expected ||
      !/^[A-Za-z0-9_-]{40,128}$/.test(state) || code.length>4096) return null;
  const hash=await sha256(state),now=nowSeconds();
  const existing=await env.WALLETS_DB.prepare(
    'SELECT code_verifier,nonce FROM realizo_oauth_states WHERE state_hash=? AND expires_at>? AND consumed_at IS NULL'
  ).bind(hash,now).first();
  if(!existing) return null;
  const consumed=await env.WALLETS_DB.prepare(
    'UPDATE realizo_oauth_states SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL AND expires_at>?'
  ).bind(now,hash,now).run();
  if(consumed.meta?.changes!==1) return null;
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      code,client_id:env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret:env.GOOGLE_OAUTH_CLIENT_SECRET,
      code_verifier:existing.code_verifier,
      redirect_uri:env.REALIZO_AUTH_ORIGIN+'/auth/google/callback',
      grant_type:'authorization_code',
    }),
  });
  if(!tokenResponse.ok) return null;
  const tokens=await tokenResponse.json();
  return verifyGoogleIdToken(tokens.id_token,env.GOOGLE_OAUTH_CLIENT_ID,existing.nonce);
}
export function clearOauthCookie(response) {
  response.cookies.set(cookie,'',{...cookieOpts,maxAge:0});
  return response;
}
