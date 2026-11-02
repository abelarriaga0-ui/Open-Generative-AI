# Realizo: acceso seguro al piloto de billeteras

**Solo para `realizo-sandbox`. No configurar en `open-generative-ai` ni en producción.**

Antes de probar recargas de PayPal con compradores Sandbox, se necesita una identidad
fiable. El código del piloto valida la firma del JWT de Cloudflare Access antes
de crear un usuario o acceder a su billetera. Sin `CF_ACCESS_TEAM_DOMAIN` y
`CF_ACCESS_AUD`, el servicio falla cerrado con 503.

## Configuración actual y excepción de PayPal

**Completado el 28 de octubre de 2026:**

- La aplicación Access `Realizo Wallet Sandbox` protege el **Worker** `realizo-sandbox`,
  tanto su URL de producción como sus URLs preview.
- Solo está asociada la política `Realizo - Usuarios de prueba` (Allow);
  no se usa la política compartida de otros proyectos.
- El Team Domain es `muddy-glitter-0708.cloudflareaccess.com`.
- El AUD de esa aplicación se guarda en GitHub Actions Secrets como
  `CF_ACCESS_AUD`, sin publicarlo.
- El flujo
  [Realizo Sandbox - connect Cloudflare Access identity](https://github.com/abelarriaga0-ui/Open-Generative-AI/actions/runs/40790405661)
  instaló los secretos `CF_ACCESS_AUD` y `CF_ACCESS_TEAM_DOMAIN` en
  `realizo-sandbox` y verificó que los secretos de PayPal Sandbox permanecen.

**Verificado el 28/10/2026 mediante la ejecución**
[Realizo Sandbox - verify public webhook and protected wallet](https://github.com/abelarriaga0-ui/Open-Generative-AI/actions/runs/40794142235):

- `GET /api/wallet` sin sesión → **HTTP 302**, redirige a Cloudflare Access.
- `POST /api/wallet/paypal/webhook` con JSON válido pero sin firma →
  **HTTP 401** y error de backend `missing_signature_headers` (no bloqueado por Access).
- `GET /api/wallet/paypal/webhook` → **HTTP 405** del backend.
- La excepción de ruta del webhook y la protección del resto del Worker
  quedaron confirmadas externamente. No se generaron órdenes ni recargas.

**Pendiente:** iniciar sesión real con una identidad incluida en
`Realizo - Usuarios de prueba`, comprobar saldo individual con dos cuentas
y probar recarga ficticia de PayPal Sandbox. No probar pagos Live.

### Referencia de configuración de ruta (ya aplicada)


1. En **Zero Trust → Access → Applications → Realizo Wallet Sandbox → Edit**
   abrir **Destinations** y localizar el destino de tipo Worker
   `realizo-sandbox`.
2. Configurar un **path override** con comportamiento `public` para la
   **ruta exacta** `/api/wallet/paypal/webhook`.
3. No utilizar `*` ni crear un bypass para todo el Worker, la página
   `/wallet` o el prefijo `/api/wallet/`. Los demás endpoints deben seguir
   exigiendo autenticación.
4. Guardar y probar: una solicitud POST al webhook **sin firma de PayPal**
   debe llegar al backend y ser rechazada con HTTP 401; **sin sesión**,
   `GET /api/wallet` debe permanecer bloqueada por Access.
5. La excepción de Access no es una autorización de pago: el código del
   webhook verifica la firma y consulta PayPal Sandbox antes de acreditar
   una orden.

Cloudflare documenta explícitamente `destinations[].overrides`, con
`behavior: "public"` y `path_pattern` exacto para destinos tipo Worker.
También puede utilizarse una app de Access más específica para esa ruta,
pero no modificar la política Allow del Worker completo.

**La excepción de webhook ya está verificada. Antes de recargar, comprobar
inicio de sesión con la cuenta autorizada y billetera creada.**

## Pruebas finales

- Sin iniciar sesión, `GET /api/wallet` no devuelve saldo ni identidades.
- Usuario A y B ven billeteras independientes y comienzan en USD 0.
- Primera recarga de USD 19.99 rechazada; USD 20.00 aceptada.
- Segunda recarga de USD 0.01 permitida por la lógica de Realizo (PayPal
  puede aplicar restricciones adicionales).
- Captura repetida y webhook duplicado no suman dos veces.
- Webhook sin firma se rechaza incluso cuando la ruta está exceptuada de Access.
- Ninguna generación usa créditos Muapi reales en este entorno.

**Importante:** esta autenticación es provisional para el piloto. El registro
público de clientes y el inicio de sesión definitivo de Realizo aún se deben
desarrollar antes del lanzamiento internacional.

Referencias Cloudflare:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
