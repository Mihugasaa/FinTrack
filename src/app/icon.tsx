import { ImageResponse } from 'next/og';

// Ícono generado (favicon + ícono de la PWA). Cuadrado a sangre completa para que
// el launcher aplique su propia máscara (maskable).
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: '#ffffff',
          fontSize: 300,
          fontWeight: 800,
          fontFamily: 'system-ui, Arial, sans-serif',
          letterSpacing: '-0.05em',
        }}
      >
        F
      </div>
    ),
    { ...size }
  );
}
