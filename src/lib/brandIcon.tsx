// Elemento del icono de marca para next/og ImageResponse. Delega en brandMark
// (unica fuente de verdad) para que el anillo con corte y el punto indigo sobre
// campo tinta se vean identicos en todos lados.

import { brandMarkDataUri } from '@/lib/brandMark';

export function brandIconElement(px: number) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <img
        width={px}
        height={px}
        src={brandMarkDataUri()}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
