import { ImageResponse } from 'next/og';
import { brandMarkDataUri } from '@/lib/brandMark';

// Ícono para "Agregar a inicio" en iOS: la MISMA marca que el favicon y el logo
// del header (línea de tendencia + F en trazos), a sangre completa. iOS aplica su
// propia máscara redondeada, por eso no se redondea aquí (evita esquinas negras).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <img
          width={180}
          height={180}
          src={brandMarkDataUri({ cornerRadius: 0, inset: 26 })}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    ),
    { ...size }
  );
}
