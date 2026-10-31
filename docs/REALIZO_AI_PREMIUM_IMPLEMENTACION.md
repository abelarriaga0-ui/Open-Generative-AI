# Realizo AI Premium — Beta segura (29 oct 2026)

## Implementación
- En Realizo Studio hay tres modos: **Automático (código)**, **Manual** y **AI Premium**.
- El modo Premium permite subir imagen propia, describir producto/servicio, elegir país y ángulo comercial opcional.
- La investigación usa **OpenAI Responses API** con imagen, búsqueda web limitada a 3 llamadas, máximo 3.100 tokens de salida, JSON estricto y procesamiento asíncrono.
- Se presenta investigación, advertencias de características no verificadas, URL de fuentes utilizadas, **tres conceptos** editables y botón de aprobación.
- La selección se convierte en un brief y llega al editor existente de video Muapi; el cargo de video permanece independiente y el usuario lo confirma allí.
- La arquitectura reutiliza sesión de Realizo, imagen privada firmada, D1, biblioteca de videos y cotización Muapi.

## Cambios técnicos
- Migración `0012_realizo_ai_premium.sql`: proyectos y costo de uso OpenAI contabilizado para el negocio, sin debitar billeteras. Una investigación al día para propietario beta, idempotencia y propiedad por usuario.
- `lib/realizo-creative/ai-premium.js`: validación, cuota de herramientas, esquema estructurado, análisis de fuentes.
- Rutas protegidas:
  - `GET/POST /api/realizo/ai-premium`
  - `GET /api/realizo/ai-premium/:id`
  - `POST /api/realizo/ai-premium/:id/approve`
- `components/RealizoPremium.jsx` y navegación en `RealizoStudio.jsx`.
- Pruebas: `tests/test_realizo_ai_premium_schema.py`, `tests/realizo-ai-premium.test.mjs`.

## Activación controlada
**Por defecto NO ejecuta OpenAI ni cobra una investigación.**
En el Worker `realizo-auth-sandbox` hay que:
1. Configurar el secreto **OPENAI_API_KEY** (nunca en el navegador, GitHub, un archivo o el chat).
2. Configurar `OPENAI_PREMIUM_MODEL` con un modelo de OpenAI Responses que admita imágenes, `web_search`, background y formato JSON estructurado.
3. Tras establecer presupuesto máximo del negocio y autorizar pruebas reales, cambiar `REALIZO_AI_PREMIUM_ENABLED` a `true` **solo en Sandbox** y desplegar.
4. Verificar una investigación completa, fuente y tres conceptos en la cuenta nativa previamente verificada de propietario y que no cambian los $7,75 de Muapi.
5. No activar OpenAI para todos los clientes ni cobrar Premium hasta añadir un **saldo general respaldado por pagos reales**, ledger separado de gastos OpenAI y política de captura/reembolso. No recargar una cuenta imaginaria.

El acceso beta está restringido a una única cuenta de Realizo cuyo `user_id` coincide con `realizo_prepaid_muapi_imports`, sin mostrar ese identificador.

## Limitaciones conscientes
- Meta Ads Library oficial no tiene acceso integral a todos los anuncios comerciales de LATAM. Esta beta usa web pública con citas; no afirma ventas, ROAS ni CPA.
- Dropkiller no está conectado a la API del sitio. La conexión desde ChatGPT no autoriza su utilización comercial desde el backend.
- El modo Premium de pago público, caché de investigación compartida y postproducción de overlays son pasos posteriores a validación de costo y licencias.
- Los clips de video siguen dependiendo de lo que cada modelo Muapi pueda generar; el prompt no garantiza fidelidad absoluta ni mejoras porcentuales.
- La investigación actual se procesa en modo background de OpenAI y se consulta al abrir el proyecto. No se reenvía en caso de error ambiguo.
- El servidor limita a **un trabajo beta por 24 horas**. Al autorizar más uso, ampliar con cuotas de gasto, rate limits y proveedor de tareas duraderas.

## Seguridad
- Sin OpenAI ni Muapi keys en frontend.
- Autenticación y comprobación de dueño en cada request.
- Tokens/identificadores de OpenAI no se devuelven al usuario.
- La foto se lee mediante enlace firmado y caduca.
- Tres conceptos se generan bajo esquema, fuente citada extraída de respuesta del proveedor, y conflictos de etiqueta requieren confirmación.
- Nunca cobrar investigaciones a partir de saldo prepagado directamente en Muapi.
- No tocar producción ni PayPal Live.

## Referencias
- https://developers.openai.com/api/docs/guides/background
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/images-vision

## Actualización general y optimización (30 oct 2026)
- **Modelo predeterminado:** `gpt-6-luna` ($0.10 / 1M tokens de entrada, $0.50 / 1M salida en modalidad estándar según tarifas verificadas). Se puede sustituir por uno de más calidad únicamente ajustando `OPENAI_PREMIUM_MODEL`, tras medir costos y resultados.
- **Presupuesto por investigación:** máximo 2 tool calls de búsqueda web, contexto `low`, 2.800 tokens máximos de salida, una imagen en `detail:low`, esfuerzo `low`, una generación de 3 conceptos. Máximo externo por búsquedas estimado: $0.02 por investigación antes de tokens (la herramienta puede elegir menos). No inferir costo real sin el objeto `usage`.
- **Reutilización:** los proyectos del mismo usuario con igual imagen, ficha, mercado y ángulo recuperan la investigación reciente y no crean un segundo cargo.
- **Precio de venta inicial configurable en próxima versión:** `PREMIUM_PRICE_CENTS=49` (USD 0.49) por paquete Premium de 3 conceptos. El video Muapi es otra operación y otra cotización.
- **Cobro general:** un pedido en `realizo_ai_premium_orders` reserva fondos en la billetera Realizo, con triggers SQL de captura tras entregar resultados válidos, o liberación cuando OpenAI rechaza o falla. Acceso público solo con `REALIZO_ENV=production`, `PAYPAL_MODE=live`, `REALIZO_AI_PREMIUM_PUBLIC_ENABLED=true`, secreto válido y pago real previamente verificado.
- **Protección de fondos externos:** el saldo histórico de USD 7.75 depositado directamente en Muapi NO puede pagar OpenAI. La cantidad original se conserva como reserva conservadora al calcular fondos disponibles para investigaciones.
- **Límites económicos atómicos:** 3 trabajos pagados por usuario/24 h, 40 globales/24 h y 500 globales/30 días. En Sandbox, solo un trabajo patrocinado/24 h para la cuenta de propietario verificada.
- **Modo gratuito:** el creador por código y el modo Manual siguen habilitados sin costo OpenAI.
- **Seguridad:** jamás agregar el secreto OpenAI a `wrangler.jsonc`, `package.json`, JS de navegador o historial de GitHub. Se instala como secreto Cloudflare. El test de integración no debe usar los fondos de Muapi.
- **Activación:** la clave se instala mediante `.github/workflows/realizo-ai-premium-configure-openai.yml` en el Worker *solo de Sandbox*. El despliegue con `REALIZO_AI_PREMIUM_ENABLED=true` activa únicamente el piloto patrocinado, porque `REALIZO_AI_PREMIUM_PUBLIC_ENABLED=false` y PayPal permanece Sandbox.
- **Producción:** `wrangler.jsonc` pertenece a `open-generative-ai`, no al nuevo Realizo con identidad nativa. No desplegar ahí por accidente. Requiere Worker Realizo separado, webhook PayPal Live verificado, D1/R2 propios, ingresos reales y autorización de un primer cargo real.
- **Fuentes:** https://developers.openai.com/api/docs/pricing , https://developers.openai.com/api/docs/models/gpt-6-luna y https://developers.openai.com/api/docs/guides/tools-web-search .
