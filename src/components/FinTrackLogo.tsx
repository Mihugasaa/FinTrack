'use client';

import React from 'react';
import { brandMarkDataUri } from '@/lib/brandMark';

interface FinTrackLogoProps {
  size?: number;
  className?: string;
  borderRadius?: number | string;
}

/**
 * Logotipo oficial de FinTrack: gradiente púrpura/índigo, línea de tendencia
 * ascendente verde y la "F" blanca en trazos. La marca sale de brandMark.ts,
 * la misma fuente que el favicon y el ícono de "agregar a inicio", para que sea
 * idéntica en todos lados. El contenedor solo aporta tamaño, sombra y redondeo.
 */
export const FinTrackLogo: React.FC<FinTrackLogoProps> = ({
  size = 34,
  className = '',
  borderRadius
}) => {
  const radius = borderRadius ?? Math.round(size * 0.26);

  return (
    <div
      className={`fintrack-logo-mark ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      <img
        src={brandMarkDataUri({ cornerRadius: 0, inset: 0 })}
        alt="FinTrack"
        width={size}
        height={size}
        style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>
  );
};
