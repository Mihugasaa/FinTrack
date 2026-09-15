'use client';

import React from 'react';

interface FinTrackLogoProps {
  size?: number;
  className?: string;
  borderRadius?: number | string;
}

/**
 * Logotipo oficial de FinTrack:
 * Contenedor con bordes redondeados, gradiente púrpura/índigo de marca,
 * línea de tendencia financiera ascendente en verde (#34d399) y la "F"
 * blanca centrada y destacada.
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
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      <svg
        viewBox="0 0 512 512"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      >
        <polyline
          points="60,372 196,318 300,346 452,206"
          fill="none"
          stroke="#34d399"
          strokeWidth="40"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Letra F estilizada con trazos vectoriales y extremos redondeados (rounded caps) */}
        <path
          d="M 205 385 L 205 145 L 320 145"
          fill="none"
          stroke="#ffffff"
          strokeWidth="52"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="205"
          y1="265"
          x2="295"
          y2="265"
          stroke="#ffffff"
          strokeWidth="52"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
