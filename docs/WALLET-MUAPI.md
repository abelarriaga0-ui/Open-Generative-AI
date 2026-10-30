# Primera etapa: wallet por cliente + única API de Muapi

**Estado:** implementación inicial en rama de desarrollo. **No habilitar cobros reales ni fusionar como producto comercial todavía.** La web original continúa usando BYOK/API key por usuario; sus estudios y proxies anteriores requieren migración al nuevo gateway antes de activar este modo para clientes.

## Reglas de negocio

- Una sola clave de Muapi para toda la plataforma: secreto Cloudflare `MUAPI_API_KEY`. La clave jamás se entrega al navegador.
- Cada usuario autenticado tiene wallet independiente en **USD**, guardada en centavos enteros.
- **Primera recarga: USD 20 como mínimo**. Después, **cualquier importe positivo** (desde un centavo).
- La recarga debe quedar confirmada mediante webhook verificado del procesador de pagos. Nunca acreditar dinero con una petición enviada desde el navegador.
- Al generar: reservar precio público configurado -> enviar a Muapi -> cobrar del reservado si se completa, o liberarlo si se confirma un fallo. Los problemas de red ambiguos retienen la reserva hasta conciliación.
- La cantidad que paga el cliente (precio público) es independiente del costo interno que cobre Muapi. Configurar precios y márgenes por modelo/variante.
- La API no acepta un precio calculado por el cliente, ni endpoints Muapi arbitrarios, ni permite cambiar duración/calidad que afecten los costos sin un precio configurado.

## Archivos implementados

- `migrations/0001_wallet.sql`: usuarios, billeteras, catálogo, recargas verificadas, trabajos, contabilidad (ledger) y triggers transaccionales.
- `lib/wallet/access-auth.js`: verificación criptográfica de JWT de Cloudflare Access, para pruebas con usuarios identificados.
- `lib/wallet/server.js`: acceso aislado a D1 y creación idempotente de reservas.
- `GET /api/wallet`: saldo, historial y modelos habilitados del usuario autenticado.
- `POST /api/wallet/generate`: sólo modelo tarifado, reserva atómica, envío al proveedor con clave global.
- `GET /api/wallet/jobs/{id}`: consulta estado, liquida reservas y devuelve resultados.
- `/wallet`: vista inicial del saldo y transacciones; cobros reales están desactivados intencionalmente.

## Configuración piloto de Cloudflare

1. Para la prueba piloto, **no tocar el Worker ni la D1 originales**. Crear
   `realizo-wallets-sandbox`, una D1 nueva e independiente:
   ```bash
   npx wrangler d1 create realizo-wallets-sandbox
   ```
2. Copiar el UUID real generado al campo `database_id` del binding `WALLETS_DB`
   en `wrangler.sandbox.jsonc`, reemplazando el UUID de ceros.
3. Validar que la base de pruebas no comparte identificador con la original y aplicar
   las **dos migraciones**:
   ```bash
   npm run wallet:preflight:sandbox
   npm run wallet:migrations:sandbox
   npm run wallet:migrate:sandbox
   npm run wallet:check:sandbox
   ```
   El preflight bloquea cualquier operación remota mientras el UUID sea falso,
   compartido o las opciones de Sandbox sean inseguras. Ver instrucciones detalladas
   en [REALIZO-SANDBOX-SETUP.md](./REALIZO-SANDBOX-SETUP.md).
4. En Cloudflare Workers > Settings > Variables and Secrets, agregar **Secret** `MUAPI_API_KEY` (el valor real se establece allí, nunca en GitHub).
5. Para la **prueba piloto**, crear una app de Cloudflare Access que proteja las rutas de la aplicación y que sólo permita usuarios de prueba. Configurar las variables del Worker:
   - `CF_ACCESS_TEAM_DOMAIN`: el subdominio del equipo Access (sin `https://`; p. ej. `mi-equipo`).
   - `CF_ACCESS_AUD`: Audience Tag exacto de la aplicación Access.
   El servidor valida la firma y destinatario del JWT antes de asignar acceso a cualquier wallet.
   Este inicio de sesión es provisional para la prueba; no reemplaza el registro/autenticación pública de clientes que elegiremos.
6. Configurar los modelos permitidos **desde una consola de administración protegida o con SQL en D1**, nunca desde clientes. Ejemplo DESACTIVADO:
   ```sql
   INSERT INTO model_prices (model_id, muapi_endpoint, customer_price_cents,
      allowed_input_keys_json, fixed_options_json, enabled)
   VALUES ('ejemplo-flux', 'flux-schnell-image', 199, '["prompt"]', '{}', 0);
   ```
   Los $1.99 del ejemplo no representan un precio real aprobado; decidir un precio de venta y confirmar el costo interno antes de habilitarlo.
7. Probar el endpoint `GET /api/wallet` con una sesión protegida. Respuestas `401` sin credenciales, `503` sin D1/Access son comportamientos de **seguridad**, no motivos para deshabilitar protección.

## No implementado aún: bloqueadores de producción

- Proveedor de pagos y checkout real, validación de firma de sus webhooks, creación de `verified_deposits`, contracargos y devoluciones.
- Migración de **todos los estudios y rutas BYOK originales** al nuevo gateway protegido. No colocar `MUAPI_API_KEY` en `NEXT_PUBLIC_*`, `localStorage`, cookies ni código cliente.
- Autenticación pública para registro/login de clientes. Cloudflare Access funciona sólo como identidad de pruebas.
- Conciliación programada y webhooks Muapi para liquidar trabajos incluso cuando el usuario cierra el navegador; revisión manual de estados ambiguos.
- Controles antifraude, rate limiting, pruebas de carga, comprobantes, reglas comerciales y auditoría de márgenes por modelo/variante.
- Pruebas de compilación/despliegue en Cloudflare de esta rama.

**No insertar pagos desde el navegador.** La única vía para aumentar fondos debe estar dentro de un proceso backend que ya verificó el evento del procesador de pagos.

## API para futura integración de los estudios

`POST /api/wallet/generate`:

```json
{
  "model_id": "modelo-habilitado-en-el-catalogo",
  "idempotency_key": "cliente-uuid-generacion-unica",
  "input": { "prompt": "Una foto comercial de producto" }
}
```

El precio de venta sale de D1 y se reserva antes de llamar a Muapi. Se devuelve `job_id`. Consultar luego `GET /api/wallet/jobs/{job_id}` hasta completar/fallar. Las claves y fondos entre usuarios nunca se comparten.

## Verificaciones recomendadas

- Usuario A no puede consultar el saldo ni trabajo de B.
- Con saldo inferior al precio, la generación no llega a Muapi.
- Reintentar con el mismo idempotency_key no duplica la reserva ni el envío.
- Fallo confirmado restaura exactamente la reserva.
- Respuesta ambigua no devuelve dinero automáticamente.
- Duplicación de evento de pago no duplica crédito.
- Primera recarga de $19.99 rechazada, primera de $20 aceptada, segunda de $0.01 aceptada.
