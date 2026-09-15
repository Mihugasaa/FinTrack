import { ImageResponse } from 'next/og';

// Ícono (favicon + PWA): línea verde ascendente (tendencia) detrás de una F blanca
// centrada, sobre el gradiente morado de la marca. Cuadrado a sangre completa.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

const trendSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
  "<polyline points='60,372 196,318 300,346 452,206' fill='none' stroke='#34d399' " +
  "stroke-width='38' stroke-linecap='round' stroke-linejoin='round'/></svg>";

export default function Icon() {
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
        }}
      >
        <img
          width={512}
          height={512}
          src={`data:image/svg+xml,${encodeURIComponent(trendSvg)}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
        <div
          style={{
            display: 'flex',
            color: '#ffffff',
            fontSize: 300,
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
