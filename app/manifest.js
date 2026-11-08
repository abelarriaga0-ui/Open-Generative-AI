/** Identidad instalable de Realizo para Android y otros navegadores compatibles. */
export default function manifest() {
  return {
    id: '/',
    name: 'Realizo',
    short_name: 'Realizo',
    description: 'Crea imágenes y videos publicitarios con inteligencia artificial.',
    start_url: '/studio',
    scope: '/',
    display: 'standalone',
    background_color: '#100c12',
    theme_color: '#100c12',
    prefer_related_applications: false,
    icons: [
      { src: '/icons/realizo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/realizo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
