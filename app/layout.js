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
  description: 'Crea y prueba videos e imágenes publicitarias con inteligencia artificial en Realizo.',
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
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
