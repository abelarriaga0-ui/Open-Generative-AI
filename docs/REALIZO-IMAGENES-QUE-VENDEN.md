# Realizo · Imágenes que venden

Implementación aislada en /studio/conversion-images. No altera Image Studio, Video Studio ni el motor de cartera.

## Primera plantilla
- ID: explosion-premium-azul
- Definición maestra: lib/conversion-templates/explosion-premium-azul.json
- Miniatura en repositorio: public/templates/explosion-premium-azul.webp (optimizada para mostrar el catálogo)
- Original de alta resolución: imagen adjunta por el propietario, 1373 × 2048 px. **La miniatura NO sirve como referencia de producción.**
- Texto y claims fijos: solo usar con producto que realmente cumpla las afirmaciones nutricionales indicadas.

## Funcionamiento
1. El cliente elige la primera plantilla; recibe nombre, precio, restricciones y miniatura sin acceder a prompts.
2. Sube JPG/PNG/WebP de hasta 10 MB.
3. Confirma que el producto cumple los beneficios fijos impresos.
4. Si el cliente describe cambios, el servidor llama a **Gemini 2.5 Flash dentro de Muapi**.
   - La IA recibe texto no confiable y una lista de cinco campos editables.
   - Devuelve JSON con cambios propuestos/rechazados.
   - El servidor valida campo por campo y rechaza rediseños, cambios de fondo y cambios de persona.
   - El costo de Gemini se reserva y se captura en wallet como una generación separada.
5. El servidor envía a **Nano Banana 2.1 Edit 4K** la plantilla original y la foto del cliente como referencias ordenadas, más el prompt maestro estricto con cambios aprobados.
6. El servidor aplica el precio de imagen desde model_prices, reserva el saldo idempotentemente y consulta el resultado en /api/wallet/jobs/[id].
7. Sin texto opcional se omite Gemini: únicamente se cobra la generación de imagen.
8. En Sandbox la generación permanece deshabilitada. No se consumen saldos reales sin configuración autorizada.

## Configuración pendiente del operador
NO habilitar cobros ni producción por instalar este módulo.

- Guardar la imagen original de alta resolución en almacenamiento de medios de lectura pública, con URL HTTPS accesible al proveedor (por ejemplo un objeto de Cloudflare R2 con dominio público).
- Configurar el secreto/variable REALIZO_TEMPLATE_EXPLOSION_URL con esa URL.
- Usar exclusivamente los endpoints Muapi `gemini-2-5-flash` y `nano-banana-2-1-edit`, confirmados en la documentación pública.
- Ejecutar el registro D1 de ejemplo `setup/REALIZO-PLANTILLAS-MODELOS.sql` en el entorno correcto: ambas filas quedan deshabilitadas.
- Verificar tarifas, asignar `customer_price_cents` y habilitar filas solo tras autorizar cobros reales.
- Configurar `REALIZO_TEMPLATE_IMAGE_MODEL_ID` y `REALIZO_TEMPLATE_ANALYZER_MODEL_ID` con los model_id registrados.
- La imagen usa obligatoriamente las opciones fijas: 4k, png, 2:3, google_search=false.
- El costo de Gemini depende de tokens en Muapi. La billetera actual usa **centavos y precio previamente configurado por solicitud**; NO constituye facturación exacta por token. Para cobro exacto se requiere implementar contabilidad subcentavo y conciliación de uso.
- El sistema continúa respetando isMuapiGenerationEnabled: no activar PAYPAL_MODE=live, MUAPI_GENERATION_ENABLED=true ni salir de REALIZO_ENV=sandbox sin autorización expresa.

## Fidelidad
Los prompts estrictos mejoran la fidelidad, pero un motor generativo puede modificar letras, rostros o adornos. Nunca prometer igualdad píxel a píxel. Para exactitud absoluta se necesitarían capas y composición controlada.

## Estado
Código de UI, analizador Gemini, endpoint Nano Banana 2.1 y pruebas de seguridad listos en rama de desarrollo. CI de sintaxis y pruebas unitarias sin despliegue. No se ha publicado, ni activado cobro, ni hecho generación contra Muapi real. Queda pendiente alojar la foto original a resolución completa y definir/aprobar precios y modelos en D1.
