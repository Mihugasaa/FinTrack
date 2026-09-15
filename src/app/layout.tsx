import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';

// Fuentes auto-hospedadas por Next (no dependen de la CDN de Google en tiempo de
// ejecucion). Asi la tipografia carga igual en todos los dispositivos y no hay
// salto ni fallback a Segoe UI/Roboto. Se exponen como variables CSS que consume
// globals.css (--font-sans / --font-mono).
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinTrack',
  description: 'Gestión inteligente de finanzas personales, flujo de caja y ciclos de facturación de tarjetas de crédito.',
  applicationName: 'FinTrack',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinTrack',
  },
  // Favicon vectorial (SVG) primero, con el PNG generado en /icon como respaldo
  // para navegadores que no soportan favicon SVG. Apple usa el PNG de /apple-icon.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="light" className={`${jakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fintrack_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  );
}
