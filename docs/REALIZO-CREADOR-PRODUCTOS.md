# Realizo — creador de videos desde producto (Sandbox)

## Flujo funcional

1. Google → `/studio` (pantalla propia, no la billetera).
2. **Crear video** → imagen principal, hasta tres referencias y datos de producto.
3. Ficha técnica en **.docx, .pdf o .txt**: el navegador extrae el texto
   seleccionable (hasta 30 páginas PDF/16.000 caracteres), sin subir el
   documento ni enviarlo a proveedores externos automáticamente.
4. Seleccionar objetivo, estilo, público, llamada a la acción y ángulo
   de venta (automático por reglas o manual). La app construye un prompt
   editable con la información aportada y evita inventar propiedades.
5. **Preparar video** → revisar/editar prompt → **Abrir editor de video**.
6. El editor original `VideoStudio` recibe el prompt y URL de producto
   firmadas, cambia a un modelo compatible **imagen→video** y conserva
   los controles originales de modelo, duración, resolución, formato, etc.
7. Barra lateral → **Mis videos** consulta los trabajos D1 del usuario.
   **Mis créditos** accede a las recargas PayPal Sandbox.

## Multimedia

- Se comprueban tipo MIME y *magic bytes* de JPG/PNG/WebP.
- El usuario autenticado carga imágenes mediante
  `POST /api/realizo/media`, usando únicamente su cookie Realizo.
- Se crean URLs HMAC temporales (hasta 48 horas) para que el motor remoto
  pueda leer la referencia, sin hacer público el almacenamiento.
- Imágenes y metadata se asocian al usuario, con cuota y validación de
  origen. Nunca se aceptan IDs de usuario proporcionados por el navegador.
- Cloudflare R2 es almacenamiento definitivo recomendado. **El token
  Cloudflare conectado no tiene permiso R2** (10000): mientras tanto el
  entorno **Sandbox** comprime imágenes y guarda máximo 900 KB por
  imagen en una tabla D1 privada. El código ya contempla R2 cuando se
  habilite el binding; no habilitar D1 blob en producción.
- Cada archivo subido temporalmente requiere una política de limpieza de
  registros caducados antes de escalar.

## Qué ocurre al pulsar «Generar»

- El original `VideoStudio` conserva la preparación de parámetros y
  la selección de modelos de Muapi.
- Existe un adaptador `generateWithRealizoWallet()` que envía el
  payload a `POST /api/wallet/generate`, espera el trabajo asincrónico,
  y recupera el resultado desde `/api/wallet/jobs/{id}`.
- El servidor impone las tarifas de `model_prices`, reservas atómicas
  en D1 y una sola clave Muapi protegida. El cliente **no** puede elegir
  ni cambiar el precio.
- En Sandbox, `MUAPI_GENERATION_ENABLED=false`: el botón permanece
  desactivado. El adaptador está cableado, pero no hay ejecución de video
  pagado ni afirmación de que las salidas estén listas.
- Para activar generación real se requiere fijar los modelos y variantes
  permitidos en `model_prices`, verificar costos por duración/calidad
  en Muapi, garantizar fondos de proveedor y habilitar un entorno
  autorizado que no sea el Sandbox de PayPal.
- Las referencias visuales influyen en los modelos compatibles, **no**
  garantizan identidad perfecta del producto ni exactitud de etiquetas.
  Revisar los clips antes de publicarlos.
- El “ángulo recomendado” funciona por reglas locales, no es todavía
  un análisis visual por IA de la imagen. Requiere un modelo de visión
  configurado para una interpretación automática de lo que aparece en foto.

## Pruebas

- `npm run test:wallet`: billeteras independientes, PayPal,
  autenticación, medios, prompt e historial.
- `npm run cloudflare:build:realizo-auth-sandbox`: compilar
  Next/OpenNext con el editor original y las nuevas pantallas.
- Sin desplegar en producción. Solo Worker `realizo-auth-sandbox`.

## Seguridad futura antes del lanzamiento

R2 privado con política de caducidad, limpieza automática, antivirus
o escaneo de medios según el riesgo, pruebas con dos cuentas,
pruebas reales de carga Word/PDF e imagen desde navegador, validación
de precios Muapi y idempotencia de generación, protección antifraude
y control de gastos, guardado permanente de videos propios.
