'use client';

import { useEffect, useRef, useState } from 'react';

function validateAmount(amount, minCents) {
  if (!/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?$/.test(amount)) {
    return 'Introduce una cantidad válida en USD (máximo 2 decimales).';
  }
  const [whole, fraction = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents >= minCents ? null : 'El mínimo de recarga es $' + (minCents / 100).toFixed(2) + '.';
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.message || json.error || 'No se pudo procesar el pago');
  return json;
}

export default function PaypalTopup({ minCents, firstTopup, onPaid, theme = 'dark' }) {
  const [amount, setAmount] = useState(firstTopup ? '20.00' : '10.00');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [cardAvailable,setCardAvailable]=useState(null);
  const [retryCount,setRetryCount]=useState(0);
  const amountRef=useRef(amount);
  amountRef.current=amount;
  const cardsRef=useRef(null);
  const nameRef=useRef(null),numberRef=useRef(null),expiryRef=useRef(null),cvvRef=useRef(null);
  const node = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/api/wallet/paypal/config', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || json.error || 'PayPal aún no configurado');
        if (active) setConfig(json);
      })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [retryCount]);

  useEffect(() => {
    if (!config || !node.current) return;
    let mounted = true;
    let buttons = null;
    let cardFields = null;
    setLoading(true);
    setCardAvailable(null);

    async function prepare() {
      const src = 'https://www.paypal.com/sdk/js?client-id=' +
        encodeURIComponent(config.client_id) + '&currency=USD&intent=capture&components=buttons,card-fields';
      const existing = document.querySelector('script[data-realizo-paypal="true"]');
      if (existing && (existing.src !== src || !window.paypal)) existing.remove();
      if (!window.paypal) {
        const script = document.createElement('script');
        script.setAttribute('data-realizo-paypal', 'true');
        script.src = src;
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('El módulo seguro de PayPal fue bloqueado o no respondió. Revisa la conexión y los bloqueadores del navegador; luego pulsa Reintentar.'));
          document.head.appendChild(script);
        });
      }
      if (!mounted || !node.current || !window.paypal?.Buttons) {
        throw new Error('PayPal no cargó los medios de pago. Pulsa Reintentar.');
      }
      const createOrder=async()=>{
        const message=validateAmount(amountRef.current,minCents);
        if(message){setError(message);throw new Error(message);}
        const result=await postJson('/api/wallet/paypal/create-order',
          {amount_usd:amountRef.current});
        return result.order_id;
      };
      const onApprove=async(details)=>{
        try{
          setStatus('Verificando el pago con PayPal...');
          const result=await postJson('/api/wallet/paypal/capture-order',
            {order_id:details.orderID});
          if(result.status==='paid'){
            setError(null);
            setStatus('Pago confirmado. Saldo acreditado en tu billetera.');
            onPaid?.();
          }else setStatus('Pago en verificación. No repitas el pago mientras se verifica.');
        }catch(failure){
          setError(failure.message);
          setStatus('Comprueba tus movimientos antes de intentar otro pago.');
        }
      };
      if(typeof window.paypal.CardFields==='function'){
        cardFields=window.paypal.CardFields({createOrder,onApprove,
          onError:()=>setError('No se pudo autorizar la tarjeta. Revisa tu actividad antes de volver a pagar.')});
        if(cardFields.isEligible()){
          cardsRef.current=cardFields;
          await Promise.all([
            cardFields.NameField().render('#realizo-paypal-card-name'),
            cardFields.NumberField().render('#realizo-paypal-card-number'),
            cardFields.ExpiryField().render('#realizo-paypal-card-expiry'),
            cardFields.CVVField().render('#realizo-paypal-card-cvv')
          ]);
          if(mounted)setCardAvailable(true);
        }else if(mounted)setCardAvailable(false);
      }else if(mounted)setCardAvailable(false);
      buttons = window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect' },
        onClick: (_, actions) => {
          setStatus('');
          const message = validateAmount(amountRef.current, minCents);
          setError(message);
          return message ? actions.reject() : actions.resolve();
        },
        createOrder,
        onApprove,
        onError: () => setError('No se pudo completar el proceso de PayPal. Revisa si hubo algún cobro antes de reintentar.'),
        onCancel: () => setStatus('Pago cancelado. No se añadió saldo.'),
      });
      if (!buttons.isEligible()) {
        if(!cardFields?.isEligible())setError('PayPal no habilitó botones ni tarjeta integrada para esta cuenta o navegador.');
        return;
      }
      await buttons.render(node.current);
    }

    prepare().catch(failure => { if (mounted) setError(failure.message); })
      .finally(()=>{if(mounted)setLoading(false);});
    return () => {
      mounted = false; cardsRef.current=null;
      try { buttons?.close(); } catch {}
      if(node.current)node.current.replaceChildren();
      for(const r of [nameRef,numberRef,expiryRef,cvvRef]) if(r.current)r.current.replaceChildren();
    };
  }, [config, minCents, onPaid, retryCount]);

  return (
    <div className="space-y-3">
      <p>{firstTopup ? 'Primera recarga mínima: $20 USD.' :
        'Puedes recargar desde $0.01 USD, sujeto a las restricciones de PayPal.'}</p>
      <label className={theme === 'light' ? 'block text-sm font-medium text-[#665977]' : 'block text-sm text-white/70'} htmlFor="paypal-topup-amount">
        Importe a recargar (USD)
      </label>
      <input id="paypal-topup-amount" type="text" inputMode="decimal" value={amount}
        onChange={event => setAmount(event.target.value)}
        className={theme === 'light' ? 'w-full rounded-2xl bg-[#F7F3EE] border border-[#DED4D8] px-4 py-3.5 text-[#251D37] outline-none focus:border-[#8F67C6]' : 'w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-white'}
        placeholder="20.00" />
      {config?.mode === 'sandbox' && (
        <p className={theme === 'light' ? 'text-[#9B6B42] text-xs font-semibold' : 'text-amber-300 text-sm font-medium'}>PayPal Sandbox · Pago de prueba</p>
      )}
      {!config && !error && <p className={theme === 'light' ? 'text-[#887B93] text-sm' : 'text-white/60 text-sm'}>Preparando PayPal...</p>}
      {loading&&<p role="status" className="text-sm text-white/70">Preparando pago seguro…</p>}
      {error && <p role="alert" className={theme === 'light' ? 'text-[#AA5C43] text-sm' : 'text-amber-300 text-sm'}>{error}</p>}
      {error&&<button type="button" onClick={()=>{setError(null);setConfig(null);setRetryCount(v=>v+1);}}
        className="rounded-lg border border-amber-400 p-2 text-amber-300 text-sm">Reintentar carga de PayPal</button>}
      {status && <p role="status" className={theme === 'light' ? 'text-[#6E4BD2] text-sm' : 'text-cyan-300 text-sm'}>{status}</p>}
      <section aria-label="Pago con tarjeta en Realizo" className="space-y-3">
        {cardAvailable===true&&<p className="font-bold">Pagar con tarjeta dentro de Realizo</p>}
        <div className={cardAvailable===false?'hidden':'space-y-3'}>
          <label className="block text-xs">Nombre de la tarjeta<div id="realizo-paypal-card-name" ref={nameRef} className="min-h-12 rounded-lg bg-white"/></label>
          <label className="block text-xs">Número de tarjeta<div id="realizo-paypal-card-number" ref={numberRef} className="min-h-12 rounded-lg bg-white"/></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">Vencimiento<div id="realizo-paypal-card-expiry" ref={expiryRef} className="min-h-12 rounded-lg bg-white"/></label>
            <label className="block text-xs">CVV<div id="realizo-paypal-card-cvv" ref={cvvRef} className="min-h-12 rounded-lg bg-white"/></label>
          </div>
          {cardAvailable===true&&<button type="button" onClick={async()=>{
            const message=validateAmount(amountRef.current,minCents);
            if(message){setError(message);return;}
            try{setError(null);await cardsRef.current?.submit();}
            catch{setError('No se pudo autorizar la tarjeta. Comprueba tus movimientos antes de reintentar.');}
          }} className="rounded-xl px-5 py-3 bg-[#F49A4B] text-[#261D36] font-bold">
            Pagar con tarjeta
          </button>}
        </div>
        {cardAvailable===false&&<p className="text-sm text-white/70">PayPal no ha habilitado el pago integrado con tarjeta para esta cuenta o región. Los datos de tarjetas nunca se solicitan directamente en Realizo.</p>}
      </section>
      <div ref={node} aria-label="Pagar con cuenta PayPal" />
      <section className="space-y-2 rounded-xl border border-white/20 p-3">
        <label className="flex gap-2 items-start text-sm"><input type="checkbox" disabled checked={false}/>
          <span>Recarga automática de $20 al llegar a $5 <strong>(todavía no disponible)</strong>.</span>
        </label>
        <p className="text-xs text-white/60">Se habilitará cuando PayPal permita guardar un método de pago con autorización expresa del cliente y el servidor tenga controles contra cargos repetidos. Actualmente no se ejecutan cargos automáticos.</p>
      </section>
    </div>
  );
}
