import { ImageResponse } from 'next/og';

// Ícono para "Agregar a inicio" en iOS: misma marca (línea de tendencia verde detrás
// de una F blanca centrada) sobre el gradiente morado. iOS redondea las esquinas.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const trendSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
  "<polyline points='60,372 196,318 300,346 452,206' fill='none' stroke='#34d399' " +
  "stroke-width='38' stroke-linecap='round' stroke-linejoin='round'/></svg>";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '40px',
          overflow: 'hidden',
        }}
      >
        <img
          width={180}
          height={180}
          src={`data:image/svg+xml,${encodeURIComponent(trendSvg)}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: 106,
            fontWeight: 800,
            fontFamily: 'system-ui, Arial, sans-serif',
            letterSpacing: '-0.05em',
          }}
        >
          F
        </div>
      </div>
    ),
    { ...size }
  );
}
