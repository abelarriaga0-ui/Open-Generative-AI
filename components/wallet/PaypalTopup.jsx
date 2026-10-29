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
  }, []);

  useEffect(() => {
    if (!config || !node.current) return;
    let mounted = true;
    let buttons = null;

    async function prepare() {
      const src = 'https://www.paypal.com/sdk/js?client-id=' +
        encodeURIComponent(config.client_id) + '&currency=USD&intent=capture&components=buttons';
      const existing = document.querySelector('script[data-realizo-paypal="true"]');
      if (existing && existing.src !== src) existing.remove();
      if (!window.paypal) {
        const script = document.createElement('script');
        script.setAttribute('data-realizo-paypal', 'true');
        script.src = src;
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error('No se pudo cargar PayPal.'));
          document.head.appendChild(script);
        });
      }
      if (!mounted || !node.current || !window.paypal?.Buttons) return;
      buttons = window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect' },
        onClick: (_, actions) => {
          setStatus('');
          const message = validateAmount(amount, minCents);
          setError(message);
          return message ? actions.reject() : actions.resolve();
        },
        createOrder: async () => {
          const result = await postJson('/api/wallet/paypal/create-order',
            { amount_usd: amount });
          return result.order_id;
        },
        onApprove: async (details) => {
          try {
            setStatus('Verificando el pago con PayPal...');
            const result = await postJson('/api/wallet/paypal/capture-order',
              { order_id: details.orderID });
            if (result.status === 'paid') {
              setError(null);
              setStatus('Pago confirmado. Saldo acreditado en tu billetera.');
              if (onPaid) onPaid();
            } else {
              setStatus('Pago en verificación. Se acreditará al confirmarse.');
            }
          } catch (failure) {
            setError(failure.message);
            setStatus('Comprueba tus movimientos; no vuelvas a pagar si el cobro ya se realizó.');
          }
        },
        onError: () => setError('No se pudo completar el proceso de PayPal. Revisa si hubo algún cobro antes de reintentar.'),
        onCancel: () => setStatus('Pago cancelado. No se añadió saldo.'),
      });
      if (!buttons.isEligible()) {
        setError('PayPal no está disponible para esta cuenta o navegador.');
        return;
      }
      await buttons.render(node.current);
    }

    prepare().catch(failure => { if (mounted) setError(failure.message); });
    return () => { mounted = false; try { buttons?.close(); } catch {} };
  }, [config, amount, minCents, onPaid]);

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
      {error && <p role="alert" className={theme === 'light' ? 'text-[#AA5C43] text-sm' : 'text-amber-300 text-sm'}>{error}</p>}
      {status && <p role="status" className={theme === 'light' ? 'text-[#6E4BD2] text-sm' : 'text-cyan-300 text-sm'}>{status}</p>}
      <div ref={node} aria-label="Botones de recarga con PayPal" />
    </div>
  );
}
