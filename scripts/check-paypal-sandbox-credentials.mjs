// Validate PayPal credentials against Sandbox OAuth only.
// Do not log client IDs, secrets, access tokens, request payloads, or API responses.
const id = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_CLIENT_SECRET;
if (typeof id !== 'string' || !id.trim() || typeof secret !== 'string' || !secret.trim()) {
  console.error('No se encontraron ambos secretos PayPal Sandbox en GitHub Actions.');
  process.exitCode = 1;
} else {
  try {
    const timeout = AbortSignal.timeout(15000);
    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      signal: timeout,
      headers: {
        Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) {
      throw new Error('PayPal Sandbox no aceptó las credenciales. HTTP ' + response.status);
    }
    const payload = await response.json();
    if (payload?.token_type?.toLowerCase() !== 'bearer' ||
        !payload.access_token || !Number.isFinite(payload.expires_in)) {
      throw new Error('PayPal Sandbox devolvió una respuesta OAuth inesperada.');
    }
    console.log('OK: credenciales PayPal Sandbox verificadas mediante OAuth.');
    console.log('No se crearon pagos, órdenes, reembolsos ni webhooks.');
  } catch (error) {
    // Never print raw remote responses, which can inadvertently contain secrets.
    console.error(error.message?.startsWith('PayPal Sandbox') ? error.message :
      'No se pudo verificar la conexión de PayPal Sandbox.');
    process.exitCode = 1;
  }
}
