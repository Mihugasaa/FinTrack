import { ImageResponse } from 'next/og';

// Ícono (favicon + PWA): línea verde ascendente (tendencia) detrás de una F blanca
// centrada, sobre el gradiente morado de la marca. Cuadrado a sangre completa.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

const logoSvg =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
  "<polyline points='60,372 196,318 300,346 452,206' fill='none' stroke='#34d399' stroke-width='40' stroke-linecap='round' stroke-linejoin='round'/>" +
  "<path d='M 205 385 L 205 145 L 320 145' fill='none' stroke='#ffffff' stroke-width='52' stroke-linecap='round' stroke-linejoin='round'/>" +
  "<line x1='205' y1='265' x2='295' y2='265' stroke='#ffffff' stroke-width='52' stroke-linecap='round'/>" +
  "</svg>";

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
          borderRadius: '112px',
          overflow: 'hidden',
        }}
      >
        <img
          width={512}
          height={512}
          src={`data:image/svg+xml,${encodeURIComponent(logoSvg)}`}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />
      </div>
    ),
    { ...size }
  );
}
