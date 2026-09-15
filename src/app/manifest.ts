import type { MetadataRoute } from 'next';

// Web App Manifest: permite instalar FinTrack como app (pantalla de inicio,
// modo standalone sin barra del navegador) y ofrece accesos rápidos al mantener
// presionado el ícono (Android).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FinTrack',
    short_name: 'FinTrack',
    description: 'Control de gastos, flujo de caja y tarjetas de crédito.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f6fa',
    theme_color: '#6366f1',
    lang: 'es',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Registrar gasto', short_name: 'Gasto', url: '/?action=new-expense' },
      { name: 'Movimientos', short_name: 'Movimientos', url: '/?tab=transactions' },
      { name: 'Tarjetas', short_name: 'Tarjetas', url: '/?tab=cards' },
      { name: 'Análisis', short_name: 'Análisis', url: '/?tab=analysis' },
    ],
  };
}
