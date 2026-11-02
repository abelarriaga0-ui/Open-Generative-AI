# Recargas PayPal en Realizo — integración piloto

**Estado: implementación inicial en rama de desarrollo, SOLO SANDBOX (pagos ficticios).** No fusionar ni activar en producción hasta completar las pruebas, el registro público y el control total de generación mediante wallets.

**Preparación vigente:** usar [REALIZO-SANDBOX-SETUP.md](./REALIZO-SANDBOX-SETUP.md)
y `wrangler.sandbox.jsonc` para el Worker separado `realizo-sandbox`.
**Completado 28/10/2026:** D1 remota aislada y migrada, Worker Sandbox publicado
en `https://realizo-sandbox.abelarriaga0.workers.dev`, PayPal Sandbox
autenticado por OAuth, credenciales instaladas en secretos de Worker y webhook
`PAYMENT.CAPTURE.COMPLETED` registrado. Ejecución exitosa:
https://github.com/abelarriaga0-ui/Open-Generative-AI/actions/runs/40777030938.
**Pendiente:** Cloudflare Access y pruebas de pagos ficticios con dos usuarios.

## Qué existe en código

- `GET /api/wallet/paypal/config`: entrega únicamente el Client ID público tras verificar sesión del usuario.
- `POST /api/wallet/paypal/create-order`: usuario autenticado elige importe USD; servidor comprueba primera recarga desde $20 y crea una orden de PayPal Orders v2 de importe fijo.
- `POST /api/wallet/paypal/capture-order`: verifica que la orden pertenece al usuario, pide captura con idempotency key y comprueba el estado autoritativo en PayPal antes de acreditar.
- `POST /api/wallet/paypal/webhook`: verifica firma contra la API oficial de PayPal y solo acredita tras obtener la orden confirmada desde PayPal.
- `migrations/0002_paypal.sql`: intenciones de compra por usuario y orden PayPal; id de captura único.
- `components/wallet/PaypalTopup.jsx`: interfaz de recarga con botón oficial y advertencia de modo de pruebas.
- Los depósitos se escriben una sola vez gracias a `UNIQUE(payment_provider, payment_reference)` y un trigger incrementa el saldo en centavos USD.

## Configuración inicial en PayPal

**Los pasos 1–6 ya se completaron para la REST App Realizo de PayPal Sandbox.**
No crear otra aplicación ni otro webhook de captura para este Worker.
La URL verificada de webhook es
`https://realizo-sandbox.abelarriaga0.workers.dev/api/wallet/paypal/webhook`.
Los comandos siguientes se conservan como documentación, no como tareas pendientes.



1. Entrar en [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Crear una **REST App** en **Sandbox**, asociada a una cuenta **Business sandbox** que reciba pagos. Generar/identificar cuentas comprador Sandbox para pruebas.
3. Copiar Client ID y Client Secret de **Sandbox** (NO de Live).
4. Agregar webhook en esa misma app con URL exacta:
   `https://TU-WORKER.workers.dev/api/wallet/paypal/webhook`
   Reemplaza por el dominio real de Worker; este ejemplo no es un enlace funcional.
5. Suscribir como mínimo `PAYMENT.CAPTURE.COMPLETED`; agregar eventos de DENIED, REFUNDED y REVERSED para auditoría operativa antes de producción.
6. Guardar el **Webhook ID** de la misma aplicación. Nunca confundir el Webhook ID con el Client ID.

## Variables y secretos en Cloudflare Workers

En el Worker asociado al proyecto, Settings > Variables and Secrets (runtime):

| Nombre | Tipo | Valor |
|---|---|---|
| `PAYPAL_MODE` | Variable | `sandbox` |
| `PAYPAL_CLIENT_ID` | Secret instalado | El Client ID del Sandbox |
| `PAYPAL_CLIENT_SECRET` | **Secret** | Client Secret del Sandbox |
| `PAYPAL_WEBHOOK_ID` | Secret instalado | Identificador del webhook configurado |
| `WALLETS_DB` | **Binding D1** | El identificador real de la base |
| `MUAPI_API_KEY` | Deshabilitado en Sandbox | No instalar una clave con fondos reales en pruebas de billetera |
| `CF_ACCESS_TEAM_DOMAIN` | Variable | Equipo Access usado para usuarios piloto |
| `CF_ACCESS_AUD` | Variable | Audience tag exacta de Cloudflare Access |

No guardar secretos en el repositorio o en capturas. El Client ID es público, pero el Client Secret y la API Key Muapi jamás deben llegar al navegador.

### D1

Para el piloto, **no usar la D1 original** `realizo-wallets` ni la configuración `wrangler.jsonc`.
La D1 `realizo-wallets-sandbox` **ya se creó** y su UUID real está en
`wrangler.sandbox.jsonc`. No volver a crearla ni sustituirlo. Los comandos
siguientes son de referencia para una instalación nueva, no se deben ejecutar
sin revisar el estado actual:

```bash
npx wrangler d1 create realizo-wallets-sandbox
# Reemplazar el UUID placeholder en wrangler.sandbox.jsonc
npm run wallet:preflight:sandbox
npm run wallet:migrations:sandbox
npm run wallet:migrate:sandbox
npm run wallet:check:sandbox
```

Las migraciones se aplican en orden mediante Wrangler. Revisar
[REALIZO-SANDBOX-SETUP.md](./REALIZO-SANDBOX-SETUP.md) antes de comandos remotos.

### Seguridad con Cloudflare Access

Los endpoints de la billetera requieren JWT válido de Access **además** de aislamiento mediante `user_id` en la base de datos. En el piloto, la aplicación Access debe proteger la zona de usuarios de la web. La ruta de webhook de PayPal **no puede estar bloqueada** por Access ni requerir login interactivo. Configurar una excepción de acceso exclusivamente para `/api/wallet/paypal/webhook` (que ya verifica la firma PayPal) usando políticas de Access apropiadas. No desproteger `/api/wallet/generate`, `/api/wallet/paypal/capture-order` ni las otras APIs protegidas.

## Pruebas antes de publicar

1. Cliente A paga $20 con comprador Sandbox y se acredita **una sola** vez; el cliente B no ve ese dinero.
2. A hace una segunda recarga por otro importe positivo y su saldo cambia correctamente.
3. Doble clic, webhook repetido o llamada repetida a captura **no duplican** saldo.
4. Un pedido cancelado/pending/denied no acredita nada.
5. Un comprador no puede acreditar su billetera enviando el ID de la orden de otro usuario.
6. Cambiar el importe en el navegador no cambia el importe esperado en el backend.
7. Error de red después de captura: la conciliación por webhook/consultar orden completa el saldo.
8. Probar reembolsos, chargebacks, devoluciones, tasas del procesador, fraude y límites por país **antes de autorizar Live**.

## Restricciones deliberadas

- `PAYPAL_MODE=live` está **bloqueado por código** hasta pasar auditorías y pruebas.
- Créditos no transferibles ni convertibles en dinero. Para países con reglas sobre valor almacenado se requiere revisión legal.
- La web original mantiene rutas BYOK (clave por usuario). Antes de salir de Sandbox habrá que migrar los estudios al gateway único, cerrar proxies no autorizados e implementar registro público.
- El esquema aún carece de un sistema automático de contracargos/reembolsos y de conciliación periódica independiente de las acciones del comprador.
- Las acreditaciones están basadas en importes USD **brutos** pagados por cliente, no en lo que recibe el comercio neto de comisiones.

## Fuentes oficiales

- https://developer.paypal.com/checkout/integrate
- https://developer.paypal.com/api/rest/webhooks/rest/
- https://developer.paypal.com/api/payments/v2/definitions/supplementary_data/
