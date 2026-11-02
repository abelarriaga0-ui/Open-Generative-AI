# Realizo — generación real limitada con Muapi (Sandbox)

**Autorización del usuario:** pruebas que consuman créditos reales de Muapi,
sin activar PayPal Live ni publicar en producción.

## Estado de integración

La rama `feature/realizo-cloudflare-auth-videos` conserva el generador original
`VideoStudio` y su selector de modelos. Se añadió un adaptador de servidor que
reserva saldo, llama a Muapi con una clave global y consulta el video.

Las comprobaciones de infraestructura confirmaron que:
- Existe exactamente **una** cuenta nativa Realizo registrada en la D1 Sandbox.
- **No había** una clave `MUAPI_API_KEY` en GitHub ni en los tres Workers
  inspeccionados en el momento del diagnóstico.
- La activación es segura cuando existe una clave Muapi de producción con
  mínimo **USD 0.30** de saldo de proveedor.

## Instalación segura (única intervención humana)

1. Obtener una API Key **real** (no una clave `is_test`) en
   https://muapi.ai/access-keys.
2. Guardarla como **GitHub Actions secret** con nombre exacto
   `REALIZO_MUAPI_API_KEY` en
   https://github.com/abelarriaga0-ui/Open-Generative-AI/settings/secrets/actions.
   **Nunca compartir el valor en chat ni almacenarlo en archivos del repo.**
3. Ejecutar **Realizo - securely connect Muapi one-generation pilot**
   desde GitHub Actions, en la rama
   `feature/realizo-cloudflare-auth-videos`, o realizar un commit
   de activación de revisión que dispare ese workflow.
4. El workflow comprueba primero el saldo de Muapi y el único usuario,
   instala los secretos exclusivamente en `realizo-auth-sandbox`,
   registra un bono de prueba de USD 0.35 y habilita en D1 un único
   modelo de prueba con tarifa fija.

## Modelo y límites

- Modelo del catálogo original: `wan2.2-image-to-video`.
- Endpoint Muapi: `POST /api/v1/wan2.2-image-to-video`.
- Opciones **fijas y validadas por servidor**: 5 s, 480p, calidad medium,
  imagen principal y relación 16:9 o 9:16.
- Precio interno de prueba: USD **0.35** en billetera (35 centavos).
- Costo público Muapi de referencia: USD **0.30** por tarea, sujeto a
  revisión antes de ampliar la comercialización.
- Cuota global en D1: **1 sola solicitud a Muapi**, incluso si el cliente
  intenta hacer solicitudes concurrentes o el proveedor responde ambiguamente.
- Solo puede consumir el usuario nativo expresamente autorizado por una
  variable privada del Worker; todos los demás quedan bloqueados.
- Imagen de entrada debe estar subida por ese mismo usuario y tener URL
  firmada aún vigente.
- El bono de prueba no se registra como depósito PayPal:
  `realizo_muapi_pilot_grants` y entrada contable
  `external_reference=pilot-credit:1`. No altera el mínimo de USD 20
  para la primera recarga verificada por PayPal.
- La tarifa del modelo se instala **deshabilitada** con migración
  `0007_muapi_pilot_catalog.sql`; se activa solo después de la
  validación real de credenciales, saldo Muapi y usuario.

## Pruebas

`npm run test:wallet` cubre:
- autenticación multiusuario y acceso por origen;
- reserva/captura/liberación de billetera;
- un solo slot de gasto con D1;
- límites y condiciones de la clave del piloto;
- bono único auditable y regla de depósito inicial de $20;
- validación de imágenes firmadas y del propietario;
- integración del catálogo y la interfaz original.

**No hacer una solicitud de generación con imágenes de usuarios reales desde
GitHub Actions**. El usuario autenticado la iniciará en
https://realizo-auth-sandbox.abelarriaga0.workers.dev/studio.
No mezclar producción ni usar PayPal real sin autorización nueva.

## Fuentes

- https://muapi.ai/playground/wan2.2-image-to-video/api
- https://muapi.ai/image-to-video-api
- https://muapi.ai/docs/credits
- https://muapi.ai/docs/api-reference
