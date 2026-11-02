// Registro idempotente de webhook PayPal Live para Realizo Production.
// No crea órdenes, no captura pagos ni imprime credenciales.
import { appendFileSync } from 'node:fs';

const endpoint = 'https://api-m.paypal.com';
const callback = 'https://realizo.abelarriaga0.workers.dev/api/wallet/paypal/webhook';
const client = process.env.REALIZO_PAYPAL_LIVE_CLIENT_ID;
const secret = process.env.REALIZO_PAYPAL_LIVE_CLIENT_SECRET;
if (!client || !secret) throw new Error('Faltan credenciales PayPal Live exclusivas.');
const base64 = Buffer.from(client + ':' + secret).toString('base64');
const tokenResponse = await fetch(endpoint + '/v1/oauth2/token',{
  method:'POST',
  headers:{Authorization:'Basic '+base64,'Content-Type':'application/x-www-form-urlencoded'},
  body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)
});
if (!tokenResponse.ok) throw new Error('PayPal Live OAuth falló HTTP '+tokenResponse.status);
const token=(await tokenResponse.json()).access_token;
if(!token)throw new Error('Token PayPal Live ausente');
async function api(path,method='GET',body){
 const r=await fetch(endpoint+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error('PayPal Live webhook HTTP '+r.status);
 return r.json();
}
const res=await api('/v1/notifications/webhooks');
const matches=(res.webhooks||[]).filter(w=>w.url===callback);
if(matches.length>1)throw new Error('Webhooks Live duplicados: requiere conciliación');
let id=matches[0]?.id;
if(id){
 if(!matches[0].event_types?.some(x=>x.name==='PAYMENT.CAPTURE.COMPLETED'))
   throw new Error('Webhook Live existente no escucha capturas completas');
}else{
 const created=await api('/v1/notifications/webhooks','POST',{url:callback,event_types:[{name:'PAYMENT.CAPTURE.COMPLETED'}]});
 if(created.url!==callback || !created.id)throw new Error('Webhook Live inválido');
 id=created.id;
}
if(!/^[A-Z0-9-]{8,80}$/.test(id)) throw new Error('ID del webhook Live inesperado');
appendFileSync(process.env.GITHUB_OUTPUT,'webhook_id='+id+'\n');
console.log('Webhook PayPal Live verificado o creado, sin procesar ningún pago.');
