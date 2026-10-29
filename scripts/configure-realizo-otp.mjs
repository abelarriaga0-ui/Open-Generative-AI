// Limit Cloudflare Access change to the existing Realizo Wallet Sandbox app.
// Never expose application policy contents, email addresses, or bearer tokens.
const account='7e405c54c1a91abbdad537f7fec379a1';
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/access';
const token=process.env.CLOUDFLARE_ACCESS_API_TOKEN;
if(!token){console.error('Falta el secreto de acceso');process.exit(1);}
const request=async(path,method='GET',payload)=>{
 const resp=await fetch(base+path,{method,headers:{
   Authorization:'Bearer '+token,'Content-Type':'application/json'
 },...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(20000)});
 const json=await resp.json().catch(()=>null);
 if(!resp.ok||!json?.success) throw new Error('Cloudflare Access API HTTP '+resp.status+' ('+method+')');
 return json.result;
};
const fail=m=>{throw new Error('SEGURIDAD: '+m)};
const apps=await request('/apps?per_page=100');
const matching=apps.filter(a=>a.name==='Realizo Wallet Sandbox');
if(matching.length!==1)fail('Realizo Wallet Sandbox debe existir exactamente una vez.');
const app=await request('/apps/'+matching[0].id);
if(app.id!==matching[0].id||app.type!=='self_hosted'||app.name!=='Realizo Wallet Sandbox')fail('Aplicación no coincide.');
console.log('DESTINATION_SHAPE='+JSON.stringify((app.destinations||[]).map(d=>({type:d.type,has_worker_id:!!d.worker_id,worker_id_is_name:d.worker_id==='realizo-sandbox',has_uri:!!d.uri,keys:Object.keys(d)}))));
if(!Array.isArray(app.destinations)||app.destinations.length!==1||app.destinations[0]?.worker_id!=='realizo-sandbox'){
 fail('Destino inesperado: no se modificó ninguna aplicación.');
}
const permittedPolicy='77222d03-b774-4132-9dbd-d0b8665c6347';
if(!Array.isArray(app.policies)||app.policies.length!==1||app.policies[0]?.id!==permittedPolicy){
 fail('La política de usuarios ya no coincide con la configuración autorizada.');
}
const idps=await request('/identity_providers?per_page=100');
const otp=idps.filter(provider=>provider.type==='onetimepin'&&provider.id);
if(otp.length!==1)fail('Proveedor One-time PIN no es único en la cuenta.');
const desiredId=otp[0].id;
if(app.allowed_idps?.length===1&&app.allowed_idps[0]===desiredId&&app.auto_redirect_to_identity===true) {
 console.log('Realizo ya utiliza exclusivamente One-time PIN. Ningún cambio requerido.');
} else {
 // PUT replaces a configuration. Preserve the current security policies,
 // Worker destination and all user-editable app options; never use another app ID.
 const fields=['domain','name','type','destinations','policies','session_duration',
 'app_launcher_visible','auto_redirect_to_identity','allow_authenticate_via_warp',
 'allow_iframe','cors_headers','custom_deny_message','custom_deny_url',
 'custom_non_identity_deny_url','custom_pages','logo_url','options_preflight_bypass',
 'skip_app_launcher_login_page','service_auth_401_redirect','http_only_cookie_attribute',
 'same_site_cookie_attribute','enable_binding_cookie','read_service_tokens_from_header',
 'self_hosted_domains'];
 const body=Object.fromEntries(fields.filter(k=>app[k]!==undefined).map(k=>[k,app[k]]));
 body.allowed_idps=[desiredId];
 body.auto_redirect_to_identity=true;
 // Important: never change destination, policy, identity or bypass application.
 await request('/apps/'+app.id,'PUT',body);
 console.log('One-time PIN seleccionado para la aplicación Realizo Wallet Sandbox.');
}
const check=await request('/apps/'+app.id);
if(check.allowed_idps?.length!==1||check.allowed_idps[0]!==desiredId||
   check.auto_redirect_to_identity!==true||
   check.name!==app.name||check.type!==app.type||
   JSON.stringify(check.destinations)!==JSON.stringify(app.destinations)||
   check.policies?.length!==1||check.policies[0]?.id!==permittedPolicy){
 fail('La comprobación posterior no coincide; revisar manualmente.');
}
console.log('OK: políticas y destino preservados; método de acceso exclusivamente One-time PIN.');
