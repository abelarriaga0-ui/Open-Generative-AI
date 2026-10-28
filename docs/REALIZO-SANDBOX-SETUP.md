# Realizo: configuración de pruebas

Preparación basada en `feature/wallet-compartida-muapi`, commit
`b754687b48a68d56c0b82a51760c80f7a082adfc`.

## Estado de esta preparación

- Configuración dedicada: `wrangler.sandbox.jsonc`, Worker `realizo-sandbox`.
- D1 para Sandbox: se exige una **base separada** llamada `realizo-wallets-sandbox`, binding `WALLETS_DB`. El UUID está intencionalmente en ceros hasta crearla; las operaciones remotas quedan BLOQUEADAS mientras tanto. La base original `realizo-wallets` no se modifica.
- Migraciones existentes: `0001_wallet.sql` y `0002_paypal.sql`.
- Ambas migraciones se ejecutaron correctamente en **D1 local emulado con Wrangler
  4.151.3**. Verificación: 7 tablas de aplicación, 7 triggers y ningún error en
  `foreign_key_check`. Pasaron 9 pruebas SQL y 9 pruebas JavaScript; 14 archivos
  JavaScript superaron el análisis de sintaxis ESM. Esto no verifica la base remota.
- PayPal solo Sandbox; el código sigue rechazando `PAYPAL_MODE=live`.
- Billeteras aisladas por identidad verificada de Cloudflare Access. Primera recarga
  mínima de USD 20; posteriores desde USD 0.01. Los montos se guardan en centavos.
- Muapi se lee exclusivamente desde el secreto de servidor `MUAPI_API_KEY` del gateway.
  En Sandbox no se envían generaciones reales: el saldo ficticio no puede gastar
  créditos del proveedor. No se han creado modelos activos ni saldos artificiales
  en una base remota.
- `REALIZO_WALLET_ONLY=true` limita el piloto a `/wallet` y `/api/wallet/*`;
  las pantallas y proxies BYOK originales quedan fuera del piloto. Migrar los
  estudios completos al gateway sigue siendo un trabajo previo al lanzamiento.
- El acceso remoto a Cloudflare no se completó en esta sesión. **No se han
  ejecutado las migraciones en D1 remoto, ni guardado secretos, ni creado una
  aplicación/webhook PayPal, ni desplegado un Worker.**

## Antes de tocar D1 remoto

**Nunca usar `realizo-wallets` para el piloto.** Un Worker separado no aísla
datos cuando dos Workers comparten una misma D1. El archivo de Sandbox ya NO
reutiliza el UUID de la base original.

1. Acceder a Cloudflare con una cuenta autorizada y ejecutar `npx wrangler whoami`.
2. Crear una **nueva** D1 remota con `npx wrangler d1 create realizo-wallets-sandbox`.
3. Copiar exclusivamente el UUID de esa base nueva al campo
   `d1_databases[0].database_id` de `wrangler.sandbox.jsonc`.
   No introducir UUIDs ficticios ni usar el ID de `realizo-wallets`.
4. Ejecutar `npm run wallet:preflight:sandbox`: bloquea UUID vacío,
   ID compartido, base incorrecta, cambios de Worker y flags que permitan
   pagos o generaciones reales.
5. Verificar desde el panel que `realizo-wallets-sandbox` es una D1 nueva y
   que no tiene datos reales antes de aplicar migraciones.

Hasta completar estos pasos, NO ejecutar comandos remotos ni desplegar Sandbox.
No modificar `main`, ni el Worker original ni la D1 original.

## Compilación y migraciones

Los scripts terminados en `:sandbox` siempre seleccionan explícitamente
`wrangler.sandbox.jsonc`. No usar `cloudflare:deploy` ni desplegar el fichero
original para esta tarea.

```bash
npm run test:wallet
npm run cloudflare:build:sandbox
npm run wallet:migrate:local
# Crear D1 Sandbox y configurar su UUID real antes de lo siguiente:
npm run wallet:preflight:sandbox
npm run wallet:migrations:sandbox
npm run wallet:migrate:sandbox
npm run wallet:check:sandbox
```

Wrangler registra cada migración aplicada en `d1_migrations`. Si la consola ya
ejecutó `setup/INICIALIZAR-D1-CONSOLA.sql`, las dos migraciones actuales usan
`IF NOT EXISTS`; revisar antes que no haya objetos distintos con los mismos nombres.
La consulta de verificación debe mostrar **7 tablas de aplicación** y ningún fallo
de integridad referencial. No borra datos ni devuelve información de clientes.

`cloudflare:upload:sandbox` comprueba primero el aislamiento D1 y sube una versión del Worker de pruebas, sin promover
el Worker original. La primera creación/configuración del Worker y la URL real
deben verificarse en Cloudflare; todavía no existe una URL confirmada para este
entorno en esta sesión. La compilación completa también está pendiente.

## Variables de runtime y secretos

Los cuatro valores de prueba siguientes están en el fichero Sandbox:

| Nombre | Valor |
|---|---|
| `REALIZO_ENV` | `sandbox` |
| `REALIZO_WALLET_ONLY` | `true` |
| `PAYPAL_MODE` | `sandbox` |
| `MUAPI_GENERATION_ENABLED` | `false` |

Los siguientes se configuran en **realizo-sandbox → Settings → Variables and
Secrets**, como valores de runtime, no solo de compilación:

| Nombre | Tipo | Origen |
|---|---|---|
| `CF_ACCESS_TEAM_DOMAIN` | Variable | Equipo Access del piloto |
| `CF_ACCESS_AUD` | Variable | Audience de la aplicación Access del piloto |
| `PAYPAL_CLIENT_ID` | Variable | REST App Sandbox de PayPal |
| `PAYPAL_WEBHOOK_ID` | Variable | Webhook de esa misma REST App Sandbox |
| `PAYPAL_CLIENT_SECRET` | Secret | REST App Sandbox de PayPal |
| `MUAPI_API_KEY` | Secret | Única cuenta de Muapi de la plataforma |

Los secretos no se pueden leer de vuelta desde Cloudflare. No copiarlos a GitHub,
variables `NEXT_PUBLIC_*`, código cliente, capturas, logs o mensajes de chat.
`.dev.vars*` y `.env*` están ignorados salvo plantillas vacías.
`keep_vars=true` conserva las variables configuradas desde el panel en el Worker
de pruebas; el binding D1 se declara explícitamente en el fichero.

## PayPal Sandbox y autenticación

1. Usar una REST App **Sandbox** asociada a una cuenta Business Sandbox.
2. Una vez verificada la URL del Worker de pruebas, registrar en esa app el webhook
   con la ruta `/api/wallet/paypal/webhook` y evento `PAYMENT.CAPTURE.COMPLETED`.
3. Guardar el Client ID, el Client Secret y el Webhook ID de esa misma aplicación.
4. Proteger `/wallet` y las APIs de usuario con Cloudflare Access. La identidad se
   valida criptográficamente; nunca se acepta un `user_id` enviado por el navegador.
5. El webhook debe poder recibir llamadas de PayPal sin login interactivo. Aplicar
   la excepción únicamente a esa ruta y comprobar que sigue exigiendo firma PayPal.
   Las políticas Access se verifican/configuran por separado, nunca se desprotege
   todo el Worker para hacer funcionar un webhook.

## Validación remota pendiente

Con dos identidades Access y cuentas compradoras Sandbox:

- A intenta USD 19.99 como primera recarga: rechazo antes de crear orden.
- A paga USD 20: saldo de A sube exactamente USD 20, B permanece en cero.
- A paga USD 0.01 después: total USD 20.01. B aún no puede recargar USD 0.01.
- Captura o webhook repetido: no duplica crédito. Cancelado o pendiente: no acredita.
- B intenta capturar una orden de A: 404. Cabeceras de identidad falsas: 401.
- Webhook sin firma o con firma inválida: 401; webhook válido: orden verificada
  con PayPal antes de acreditar.
- `/api/v1/*`, `/api/app/*` y `/api/workflow/*`: bloqueadas en el piloto.
- Generación con saldo Sandbox: bloqueada sin llamar Muapi ni reservar saldo.

No se han realizado estas pruebas con cuentas externas. No activar cobros reales,
recargas automáticas o producción sin autorización expresa del propietario.

## Referencias oficiales

- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/configuration/environments/
- https://opennext.js.org/cloudflare/cli
- https://developer.paypal.com/api/rest/webhooks/rest/
- https://developer.paypal.com/sdk/js/v5/best-practices
