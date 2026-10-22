# Despliegue en Cloudflare Workers

Este repositorio es una copia de Open Generative AI con preparación para OpenNext y Cloudflare Workers. Todavía NO se ha verificado una compilación/despliegue real: el proyecto incluye submódulos, varios paquetes y funcionalidades específicas de escritorio.

## Crear el Worker desde el panel

En https://dash.cloudflare.com/ > Workers & Pages > Crear aplicación > Conectar GitHub:
- Repositorio: `abelarriaga0-ui/Open-Generative-AI`
- Nombre del proyecto: `open-generative-ai` (mismo valor que wrangler.jsonc)
- Rama: `main`
- Directorio raíz: `/`
- Build: `npm run cloudflare:build`
- Deploy: `npx opennextjs-cloudflare deploy`
- Preview: `npx opennextjs-cloudflare upload` (o desactivar previews hasta completar el primer despliegue)

IMPORTANTE: en la configuración avanzada de Builds agregar la variable de compilación:
`SKIP_DEPENDENCY_INSTALL=1`.
Esto evita que Cloudflare intente `npm install` antes de descargar los submódulos. El script `cloudflare:build` hace la instalación en el orden adecuado.

El script `cloudflare:build`:
1. descarga los submódulos Git;
2. instala dependencias más OpenNext/Wrangler para la compilación (sin modificar el lock);
3. compila los paquetes workspace;
4. compila Next.js y adapta su salida al runtime Workers.

La primera compilación puede tardar y puede fallar por incompatibilidades o límites de tamaño, memoria y tiempo; consultar logs. La app utiliza Muapi para generaciones en la nube y requiere una clave y créditos del proveedor. Nunca publicar claves de API en el repositorio.

Guías: https://opennext.js.org/cloudflare/get-started y https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/
