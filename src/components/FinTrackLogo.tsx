'use client';

import React from 'react';

interface FinTrackLogoProps {
  size?: number;
  className?: string;
  borderRadius?: number | string;
  // 'mark' = marca a pelo, se adapta al tema (anillo con color de texto, punto
  // indigo). 'tile' = icono de app en campo tinta (igual al instalable).
  variant?: 'mark' | 'tile';
}

/**
 * Logotipo de FinTrack dibujado como SVG en linea (vector puro, nitido a
 * cualquier tamano). El anillo es el ciclo de facturacion; el punto, la fecha
 * real en que el dinero se mueve. En variante 'mark' el anillo usa el color de
 * texto del tema para leer bien tanto en claro como en oscuro.
 */
export const FinTrackLogo: React.FC<FinTrackLogoProps> = ({
  size = 34,
  className = '',
  borderRadius,
  variant = 'mark',
}) => {
  const isTile = variant === 'tile';
  const ring = isTile ? '#ffffff' : 'var(--text-primary)';
  const dot = isTile ? '#6366f1' : 'var(--accent-brand)';
  const rawRadius = typeof borderRadius === 'number' ? borderRadius : size * 0.26;
  const rx = (rawRadius / size) * 120;

  return (
    <svg
      className={`fintrack-logo-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="FinTrack"
      style={{ display: 'block', flexShrink: 0, userSelect: 'none' }}
    >
      {isTile && <rect width="120" height="120" rx={rx} ry={rx} fill="#0f172a" />}
      <g transform="rotate(-52 60 60)">
        <circle
          cx="60"
          cy="60"
          r="38"
          fill="none"
          stroke={ring}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray="205 33.76"
        />
      </g>
      <circle cx="60" cy="60" r="11" fill={dot} />
    </svg>
  );
};
