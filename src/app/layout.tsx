import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'FinTrack - Control Inteligente de Gastos y Tarjetas',
  description: 'Gestión inteligente de finanzas personales, flujo de caja y ciclos de facturación de tarjetas de crédito.',
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
            __html: `(function(){try{document.documentElement.setAttribute('data-theme','light');localStorage.setItem('fintrack_theme','light');}catch(e){}})();`,
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
