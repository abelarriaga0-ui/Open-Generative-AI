# Realizo: acceso seguro al piloto de billeteras

**Solo para `realizo-sandbox`. No configurar en `open-generative-ai` ni en producción.**

Antes de probar recargas de PayPal con compradores Sandbox, se necesita una identidad
fiable. El código del piloto valida la firma del JWT de Cloudflare Access antes
de crear un usuario o acceder a su billetera. Sin `CF_ACCESS_TEAM_DOMAIN` y
`CF_ACCESS_AUD`, el servicio falla cerrado con 503.

## Configurar en Cloudflare Zero Trust

1. Ir a **Zero Trust → Access → Applications → Create application → Self-hosted**.
2. Dar nombre `Realizo Wallet Sandbox`. Proteger únicamente el hostname real
   `realizo-sandbox.<subdominio-de-la-cuenta>.workers.dev`. Confirmar el subdominio
   de la ejecución de GitHub; no inventarlo.
3. Añadir una política **Allow** limitada a **dos cuentas de prueba**. Usar
   un método de inicio de sesión habilitado en Zero Trust (por ejemplo,
   código de un solo uso al correo). No activar **Everyone** como Allow.
4. Crear una aplicación de Access separada, de ruta **más específica**:
   `realizo-sandbox.<subdominio>.workers.dev/api/wallet/paypal/webhook`.
   Su política será **Bypass → Everyone**, únicamente para recibir los POST
   de PayPal sin inicio de sesión. El backend sigue exigiendo firma válida,
   `PAYPAL_WEBHOOK_ID` correcto y verificación PayPal API.
   Confirmar en Cloudflare que la ruta específica tiene precedencia.
5. Ir a **Zero Trust → Settings** y copiar el **Team domain**; luego abrir
   la aplicación de billetera y copiar el **Application Audience (AUD) Tag**.
6. Configurar en el Worker `realizo-sandbox`, **Settings → Variables and Secrets**:
   - `CF_ACCESS_TEAM_DOMAIN`: nombre de equipo o hostname
     `<team>.cloudflareaccess.com` (sin protocolo)
   - `CF_ACCESS_AUD`: etiqueta AUD **de la aplicación de billetera** (no de
     la excepción de webhook)
7. Probar dos cuentas diferentes y comprobar rechazo sin sesión antes de
   permitir recargas. Un usuario no puede leer ni capturar órdenes de otro.

## Pruebas finales

- Sin iniciar sesión, `GET /api/wallet` no devuelve saldo ni identidades.
- Usuario A y B ven billeteras independientes y comienzan en USD 0.
- Primera recarga de USD 19.99 rechazada; USD 20.00 aceptada.
- Segunda recarga de USD 0.01 permitida por la lógica de Realizo (PayPal
  puede aplicar restricciones adicionales).
- Captura repetida y webhook duplicado no suman dos veces.
- Webhook sin firma se rechaza incluso si pasa el Bypass de Access.
- Ninguna generación usa créditos Muapi reales en este entorno.

**Importante:** esta autenticación es provisional para el piloto. El registro
público de clientes y el inicio de sesión definitivo de Realizo aún se deben
desarrollar antes del lanzamiento internacional.

Referencias Cloudflare:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
