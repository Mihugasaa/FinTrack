import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'FinTrack',
  description: 'Gestión inteligente de finanzas personales, flujo de caja y ciclos de facturación de tarjetas de crédito.',
  applicationName: 'FinTrack',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FinTrack',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
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
