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
