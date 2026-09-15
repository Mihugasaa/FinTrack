import { ImageResponse } from 'next/og';

// Ícono para "Agregar a inicio" en iOS (apple-touch-icon). iOS redondea las
// esquinas por su cuenta, así que va cuadrado a sangre completa.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 108,
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
