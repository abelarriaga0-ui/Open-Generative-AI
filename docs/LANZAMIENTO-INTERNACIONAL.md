# Alcance internacional — Realizo / Open Generative AI

**Mercado:** lanzamiento mundial, con experiencia inicial en español y foco en todos los países hispanohablantes donde las regulaciones y los proveedores admitan operaciones. No limitar registros a Ecuador. No prometer cobertura universal: algunos países no están permitidos por proveedores/compliance.

## Producto

- Una única cuenta y secreto Muapi en el servidor `MUAPI_API_KEY`; los clientes jamás reciben esa clave.
- Una cuenta, historial y billetera de **créditos internos de consumo** por cliente en Cloudflare D1; claves extranjeras y datos financieros no se comparten.
- Saldo expresado en USD para todos, independiente de la divisa original del cobro.
- Primera compra de créditos por al menos USD 20. Desde la segunda, cualquier importe positivo permitido por proveedor y comisiones mínimas.
- Créditos sólo utilizables dentro de Realizo para generaciones; **no transferibles entre usuarios ni canjeables por efectivo** (requiere revisión legal/condiciones específicas por jurisdicción).
- Catálogo con precio de VENTA en USD por modelo, resolución, duración y extras; separar y medir el costo de Muapi por generación para estimar márgenes y utilidades.
- La disponibilidad por país puede variar: listado configurable de países permitidos, tasas/impuestos, KYC, prevención de fraude, límites, sanciones y política de devoluciones.

## Pagos internacionales

**Proveedor candidato principal: Paddle**, sujeto a aprobación real de la cuenta y del negocio. Las fuentes oficiales indican:
- Venta en más de 200 países/territorios, con impuestos gestionados como merchant of record.
- El producto AI permite **créditos prepagados** como compras de una sola vez registrando saldo internamente.
- `POST /transactions` admite precios variables non-catalog/inline, útiles para recargas no fijas.
- Mostrar precio localizado en el checkout, pero **acreditar el importe base en USD** solo tras webhook firmado y compra conciliada.
- Existen países excluidos, incluidos algunos hispanohablantes, por sanciones o políticas del proveedor.

**Proveedor adicional para pagos locales de Latinoamérica: dLocal Go**, sujeto a alta, aprobación y cobertura real. No sirve como único proveedor para países europeos como España; la documentación de su producto Go enumera países latinos soportados.

Fuentes:
- https://developer.paddle.com/get-started/how-paddle-works/ai-companies/
- https://developer.paddle.com/concepts/sell/supported-countries-locales/
- https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- https://developer.paddle.com/build/transactions/bill-create-custom-items-prices-products/
- https://developer.paddle.com/webhooks/about/signature-verification/
- https://helpcenter.dlocalgo.com/es/articles/7846587-en-que-paises-puedo-vender-con-dlocal-go

## Flujo financiero fiable (pendiente de integrar pasarela)

1. Usuario con sesión autenticada elige recarga en USD en su cuenta.
2. Servidor valida mínimo inicial y crea `topup_intent` con ID único y monto USD autorizado. Nunca usar monto que regrese del navegador para acreditar.
3. Servidor crea transacción en pasarela, conserva ID, moneda local, monto real en moneda local, tasa aplicada por proveedor e impuestos cobrados.
4. Usuario paga con método permitido por su país.
5. **Webhook verificado** y/o consulta a la pasarela validan ID, moneda, estado final, monto de USD comprado y pertenencia de la intención a ese usuario.
6. Base de datos registra `verified_deposits` una sola vez mediante clave única proveedor/transacción, y un trigger acredita el equivalente USD al saldo del usuario.
7. Reembolsos/contracargos nunca deben acreditar saldo nuevo. Implementar reversos compensatorios, gestión de consumo ya realizado y bloqueo de wallet negativa si hay contracargo; definir políticas comerciales claras.
8. Auditoría guarda país de compra y la moneda/monto originalmente cobrados, sin convertir arbitrariamente con datos del navegador.

**No activar pagos ni generar cargos hasta completar pruebas de webhooks, reintentos y cobros locales.**

## UI internacional

- Interfaz en español (inicialmente es-EC/es-CO/es-MX/es-ES) con localización de fechas e importes.
- Saldo siempre presentado como USD; checkout puede mostrar moneda del país antes de pagar con impuestos y comisiones visibles.
- Selección/confirmación de país de facturación, sin deducirlo ciegamente de IP.
- Los términos pueden usar «créditos de generación» o «saldo de consumo», evitando prometer servicios bancarios ni retiro de efectivo.

**Estado de implementación:** la rama de wallet contiene estructura y endpoints piloto; registro público, frontend conectado con todos los estudios, checkout y conciliación no están listos. No fusionar a producción.
