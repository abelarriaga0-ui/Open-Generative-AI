# Realizo: multiusuario, PayPal Sandbox y generación de videos

## Objetivo y separación de entornos

Realizo es un servicio de **generación de videos con IA**. El objetivo del
bloque actual es registro e inicio de sesión propio, cuentas/billeteras
independientes, recargas mediante PayPal Sandbox y una pasarela segura de
generaciones con una sola clave Muapi en el servidor.

**Entornos totalmente separados:**
- Producción `open-generative-ai`: no tocar ni publicar cambios.
- Piloto anterior `realizo-sandbox`: sigue protegido por Cloudflare Access.
- Nuevo `realizo-auth-sandbox`: UI propia de Realizo; no depende del login
  administrativo de Cloudflare, y utiliza **solo D1 Sandbox**.
- La nueva identidad nativa es `auth_provider=realizo` con un UUID interno.
  Las identidades antiguas de Cloudflare Access no se asocian automáticamente
  por correo ni comparten saldos.

## Implementado

1. Página `/login` de Realizo (Google y código de correo de 8 dígitos),
   no una página de Cloudflare; /api/auth/features expone qué métodos están
   realmente listos.
2. Rutas seguras: solicitud/verificación de código, inicio/callback Google
   OIDC con state, nonce, PKCE, firma RS256 y `email_verified`, `/api/auth/me`
   y cierre de sesión.
3. D1: `0003_realizo_identity.sql` crea cuentas, identidades, sesiones con
   hash de token, desafíos de correo con HMAC y límites de intentos, y
   estados OAuth de un solo uso.
4. Sesiones en cookies `__Host-realizo_session` HttpOnly, Secure, SameSite=Lax;
   cookie no determina saldo: el servidor busca el ID verificado en D1.
5. La billetera conserva triggers contables: primer depósito mínimo USD 20,
   siguientes importes positivos, captura idempotente y separación por cliente.
6. PayPal Sandbox (sin cobros reales), verificación server-to-server y
   webhook que rechaza peticiones no firmadas.
7. Página `/create` como puerta de entrada al flujo de generación de videos:
   catálogo de modelos habilitados, precio del servidor, prompt, imagen de
   referencia opcional, reserva y consulta de estado.
8. Muapi: clave global solo en el servidor, catálogo tarifado; generación
   bloqueada en Sandbox para no consumir fondos reales.
9. Pruebas Python SQLite, pruebas Node y compilación Next/OpenNext, CI
   totalmente separado del Worker de producción.

## Configuración pendiente para activar registro propio

El código falla cerrado y **no permite generar sesiones reales** cuando
faltan las siguientes credenciales. Estas se deben establecer únicamente
como secretos del Worker `realizo-auth-sandbox`:

- `REALIZO_AUTH_PEPPER` — se genera aleatoriamente solo la primera vez en el
  Worker, no publicarlo ni rotarlo sin plan de invalidación de sesiones/códigos.
- `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` — un OAuth
  client **Web application** dedicado a Realizo (Google Cloud). Registrar
  la URL exacta:
  `https://realizo-auth-sandbox.abelarriaga0.workers.dev/auth/google/callback`.
  En Google OAuth deben configurarse los consentimientos/orígenes necesarios.
- `RESEND_API_KEY` y `REALIZO_EMAIL_FROM` — la cuenta de envío deberá tener
  un dominio propio verificado antes de activar registro por correo. El
  remitente debe pertenecer a ese dominio. Nunca incrustar el token en JS
  navegador ni en el repositorio.

**Estas credenciales NO son intercambiables con el login de Cloudflare Access.**
No copiar Google Cloud Console credenciales directamente por chat; utilizar
Cloudflare Worker secrets. No usar el proyecto Supabase de otra aplicación.

## Validaciones obligatorias antes de habilitar clientes

- Anónimo: `GET /api/wallet` => 401 sin datos; ningún acceso al ledger.
- A y B: saldos individuales, trabajos individuales y sesiones distintas;
  el correo de otro cliente no permite consultar sus fondos.
- Correo: código expirado, incorrecto o reutilizado se rechaza y se limita.
- Google: `state` sin cookie, nonce inesperado, audiencia inválida y token
  sin firma válida se rechazan.
- PayPal: $19.99 primera recarga rechazada; $20 aceptada; segunda recarga
  positiva; no acreditar dos veces una captura.
- Webhook inválido: 401; solicitudes no verificadas no aumentan saldo.
- Muapi: desactivado en Sandbox, BYOK original bloqueado; no inventar
  resultados ni disminuir créditos en pruebas sin backend auténtico.
- Antes de producción: SPF/DKIM dominio, rate limiting a nivel Cloudflare,
  antifraude, políticas legales, devolución/contracargos, cuotas, límites de
  gasto y precios por duración/calidad de cada modelo; pruebas completas
  de video y conciliación de trabajos.

## Archivos relevantes

- `lib/realizo-auth/`: módulos de autenticación nativa.
- `app/api/auth/`, `app/auth/google/callback/`: endpoints.
- `app/login/`, `app/create/`, `app/wallet/`: pantallas.
- `migrations/0001_wallet.sql`, `0002_paypal.sql`, `0003_realizo_identity.sql`.
- `wrangler.auth-sandbox.jsonc`: nuevo Worker, misma D1 aislada Sandbox.
- `.github/workflows/realizo-native-auth-sandbox.yml`: CI y despliegue
  solo de Sandbox, sin pagos Live ni Muapi real.

**No fusionar ni publicar en producción sin autorización explícita.**
