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
4. El servidor sube la imagen con la API central de Muapi y arma una solicitud con dos referencias:
   - primera: plantilla original de alta resolución;
   - segunda: producto del cliente.
5. El prompt maestro restringe la edición al envase central.
6. La generación utiliza model_prices, reserva saldo por idempotency_key y consulta resultados con /api/wallet/jobs/[id].
7. En Sandbox la generación permanece deshabilitada. No se consumen saldos reales sin configuración autorizada.

## Configuración pendiente del operador
NO habilitar cobros ni producción por instalar este módulo.

- Guardar la imagen original de alta resolución en almacenamiento de medios de lectura pública, con URL HTTPS accesible al proveedor (por ejemplo un objeto de Cloudflare R2 con dominio público).
- Configurar el secreto/variable REALIZO_TEMPLATE_EXPLOSION_URL con esa URL.
- Elegir un modelo Muapi de image-to-image que soporte **dos referencias ordenadas** usando el campo images_list y prompt; verificar el contrato exacto del endpoint con una prueba no productiva.
- Registrar ese modelo y el costo comercial REAL en la tabla model_prices, de la misma manera que el resto de modelos. Se necesitan allowed_input_keys_json con prompt e images_list y fixed_options_json con las opciones de resolución/precio autorizadas.
- Configurar REALIZO_TEMPLATE_IMAGE_MODEL_ID con ese model_id.
- El sistema continúa respetando isMuapiGenerationEnabled: no activar PAYPAL_MODE=live, MUAPI_GENERATION_ENABLED=true ni salir de REALIZO_ENV=sandbox sin autorización expresa.

## Fidelidad
Los prompts estrictos mejoran la fidelidad, pero un motor generativo puede modificar letras, rostros o adornos. Nunca prometer igualdad píxel a píxel. Para exactitud absoluta se necesitarían capas y composición controlada.

## Estado
Código de UI y endpoints listo en la rama de desarrollo. No se ha publicado, ni activado cobro, ni hecho generación contra Muapi real. Queda pendiente integrar el asset original externo y definir precio/modelo aprobados.
