import { ImageResponse } from 'next/og';
import { brandMarkDataUri } from '@/lib/brandMark';

// Ícono (favicon + PWA any/maskable): marca oficial de FinTrack a sangre completa.
// Cuadrado sin redondear (el SO aplica su propia máscara al instalarlo) y con la
// marca dentro de la zona segura para que la máscara circular de Android no la corte.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <img
          width={512}
          height={512}
          src={brandMarkDataUri({ cornerRadius: 0, inset: 48 })}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    ),
    { ...size }
  );
}
