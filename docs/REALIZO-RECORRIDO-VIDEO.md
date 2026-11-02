# Realizo — recorrido de usuario del estudio

Actualizado: 2026-10-28.

## Recorrido principal

1. `/login`: inicio de sesión de Realizo (Google; email cuando se configure).
2. Tras iniciar sesión: `/studio` (**video primero**, no billetera).
3. `/studio` y `/studio/video`: la interfaz de generación original
   `VideoStudio` de `packages/studio/src/components/VideoStudio.jsx`, no
   el formulario básico basado en los precios de D1.
4. Barra superior: logo Realizo, **Estudio de videos**, **Mis créditos**, salir.
5. `/wallet`: recargas PayPal Sandbox, saldos y movimientos contables. Secundaria.
6. URL antigua `/create` redirige al estudio en el entorno nativo de Realizo.
7. El despliegue original no nativo sigue usando `StandaloneShell`.

## Apariencia

Aplicar el mismo sistema visual editorial premium del login: marfil
`#F7F3EE`, tinta berenjena `#261E3F`, coral `#FFAE9C`, violeta
`#6E4BD2`, detalles menta. El editor original conserva su estructura
y sus controles, dentro del contenedor de marca.

## Seguridad

- La ruta `/studio` exige cookie validada en D1 desde el servidor.
- Cada usuario tiene un ID de alcance independiente para el historial
  local del editor en ese navegador.
- El catálogo visible del editor original no equivale al catálogo de
  modelos facturables habilitados; no se inventan precios.
- En Sandbox `previewOnly` mantiene el botón de generación deshabilitado
  y los proxy BYOK `/api/v1`, `/api/app`, `/api/workflow` bloqueados.
- Los usuarios no reciben la clave global de Muapi.
- Activar generación real con crédito por usuario requiere enlazar
  las acciones originales del editor a `/api/wallet/generate` usando
  precios por modelo, variantes y opciones, y aprobar el entorno
  que puede gastar créditos del proveedor. Eso NO se activa en esta
  actualización visual.

## Comprobaciones

`npm run test:wallet` y `npm run cloudflare:build:realizo-auth-sandbox`.
Solo se despliega `realizo-auth-sandbox`, sin modificar producción
ni `realizo-sandbox`.
