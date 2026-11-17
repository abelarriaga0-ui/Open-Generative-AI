import './globals.css';
import './realizo-visual.css';
import './realizo-redesign-v9.css';
import './realizo-premium-v11.css';
import './realizo-template-creator.css';
import './realizo-motion-home.css';
import './realizo-conversion-images.css';
import { Inter } from "next/font/google";
import { headers } from 'next/headers';
import { getLocaleConfig } from '@/lib/locales';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Realizo | Estudio creativo con IA',
  description: 'Crea videos e imágenes publicitarias con inteligencia artificial. Plantillas UGC, imágenes que venden y modo libre para anuncios que destacan.',
  applicationName: 'Realizo',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/realizo-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/realizo-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/icons/realizo-192.png', sizes: '192x192' }],
  },
  appleWebApp: { capable: true, title: 'Realizo', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'Realizo — Crea videos con IA',
    description: 'De una foto a algo extraordinario. Videos e imágenes publicitarias con inteligencia artificial.',
    siteName: 'Realizo',
    images: [{ url: '/icons/realizo-512.png', width: 512, height: 512, alt: 'Realizo' }],
    type: 'website',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary',
    title: 'Realizo — Crea videos con IA',
    description: 'De una foto a algo extraordinario. Videos e imágenes publicitarias con inteligencia artificial.',
    images: ['/icons/realizo-512.png'],
  },
};

export const viewport = { themeColor: '#100c12' };

export default async function RootLayout({ children }) {
  // Locale is derived from the URL path by middleware.js and passed
  // through as a plain response header — the root layout is shared by
  // every locale's route tree, so it can't take a `locale` prop directly.
  const headerList = await headers();
  const { htmlLang } = getLocaleConfig(headerList.get('x-locale'));

  return (
    <html lang={htmlLang}>
      <head>
        <link rel="preconnect" href="https://cdn.muapi.ai" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.muapi.ai" />
        <link rel="preconnect" href="https://api.muapi.ai" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Realizo',
            description: 'Genera videos e imágenes publicitarias con inteligencia artificial',
            url: 'https://realizo-auth-sandbox.abelarriaga0.workers.dev',
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Web',
            inLanguage: 'es',
          })}}
        />
      </head>
      <body className={inter.variable}>
        <a href="#main-content" className="realizo-skip-link">Saltar al contenido principal</a>
        {children}
      </body>
    </html>
  );
}
