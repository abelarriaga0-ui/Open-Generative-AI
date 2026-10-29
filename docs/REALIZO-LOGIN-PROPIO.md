# Realizo — inicio de sesión propio (fase de desarrollo)

## Por qué se cambia
El piloto `realizo-sandbox` todavía utiliza Cloudflare Access, que muestra una
pantalla de Cloudflare a los visitantes. **La experiencia pública de Realizo
debe ofrecer una pantalla `/login` en nuestro propio sitio**, con Google y
correo electrónico. Cloudflare continuará alojando el Worker y D1, pero no
será el sistema de registro de clientes.

La implementación en `feature/realizo-login-propio` añade:
- Página `/login` en español, con diseño de Realizo.
- Inicio de sesión con Google y correo (enlace y soporte para código OTP)
  mediante un proveedor administrado de autenticación.
- OAuth PKCE callback, cierre de sesión y consulta de sesión.
- Verificación de usuario contra Supabase Auth en el servidor antes de obtener
  el saldo de D1. Los correos y `user_id` enviados por clientes **nunca**
  constituyen una identidad de billetera.
- Cada usuario se almacena en D1 bajo `auth_provider='supabase'` y su ID
  verificado: las billeteras siguen separadas por usuario.

## Importante: todavía no activo

**No se publica ni se cambia `realizo-sandbox` mientras se prepara el
proveedor de autenticación.** El Worker actual sigue protegido por Access y
PayPal continúa únicamente en modo Sandbox.

La integración está deshabilitada a propósito hasta configurar una instancia
de Auth **dedicada a Realizo**, con URL y clave publicable. No reutilizar
automáticamente proyectos de nombres parecidos.

Configuración requerida antes del despliegue de prueba (no hay claves
configuradas en esta rama):

- `REALIZO_AUTH_PROVIDER=supabase` en el runtime de un Worker Sandbox
  **distinto**, o solo después de validar el nuevo acceso.
- `NEXT_PUBLIC_REALIZO_AUTH_URL=https://<proyecto>.supabase.co`
- `NEXT_PUBLIC_REALIZO_AUTH_PUBLISHABLE_KEY=sb_publishable_...`

Ambas variables `NEXT_PUBLIC_...` son **públicas**, no son API secretas, y
deben estar disponibles durante la compilación de Next.js. Nunca instalar una
`service_role` o secret key en el navegador, GitHub público o frontend.

En el proveedor de Auth:
1. Activar Google OAuth con un cliente OAuth verificado de la aplicación Realizo.
2. Configurar Email OTP/enlace mágico con SMTP transaccional verificado,
   plantillas y límites de frecuencia. Para recibir un **código**, la plantilla
   debe incluir `{{ .Token }}`; si no, se utiliza el enlace mágico.
3. Configurar las URL de redirección autorizadas:
   `https://<host-del-piloto>/auth/callback` y el sitio propio al lanzar.
4. Confirmar emails; aplicar protección antibots/rate limiting; políticas de
   expiración de sesiones adecuadas para recargas.

## Seguridad y migración de usuarios

- No retirar Cloudflare Access del piloto actual hasta probar primero
  autenticación propia en **otro hostname/Worker de desarrollo**.
- No exponer `/api/wallet` ni las recargas de PayPal a usuarios anónimos.
  El token y su sesión se verifican **del lado del servidor** usando `getUser()`.
- No enlazar automáticamente identidades Access previas con nuevas
  identidades Supabase solo por coincidir el correo electrónico. Las cuentas
  deben migrarse mediante una operación autenticada/auditada.
- Recargas y movimientos permanecen en Cloudflare D1, no se copian a
  tablas públicas de Supabase.
- Antes de lanzar al público, probar dos usuarios distintos, cierre de
  sesión, expiración, OAuth Google, email, idempotencia de PayPal y resistencia
  a solicitudes cruzadas; valorar MFA en cuentas con saldo.

Referencias:
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/auth-email-passwordless
