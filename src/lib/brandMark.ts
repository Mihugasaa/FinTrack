// Marca FinTrack en una sola fuente de verdad: gradiente de marca + línea de
// tendencia verde ascendente + "F" blanca en trazos con extremos redondeados.
// La usan el logo del header, el favicon/PWA y el ícono de "agregar a inicio",
// para que se vean idénticos en todos lados y no vuelvan a divergir.

export const BRAND_GRADIENT_FROM = '#6366f1';
export const BRAND_GRADIENT_TO = '#8b5cf6';

interface BrandMarkOptions {
  // Radio de esquina en unidades del lienzo 512 (0 = cuadrado a sangre, ideal
  // para íconos instalables porque el SO aplica su propia máscara redondeada).
  cornerRadius?: number;
  // Padding interno de la marca en unidades de 512 (zona segura para máscaras
  // maskable de Android). 0 = la marca ocupa todo el lienzo (uso en el header).
  inset?: number;
}

/**
 * Devuelve el SVG completo de la marca (fondo con gradiente + línea de tendencia
 * + F) listo para incrustar como data-URI o como imagen de ImageResponse.
 */
export function brandMarkSvg({ cornerRadius = 0, inset = 0 }: BrandMarkOptions = {}): string {
  const scale = (512 - inset * 2) / 512;
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
    "<defs><linearGradient id='fintrackBrand' x1='0' y1='0' x2='1' y2='1'>" +
    `<stop offset='0' stop-color='${BRAND_GRADIENT_FROM}'/>` +
    `<stop offset='1' stop-color='${BRAND_GRADIENT_TO}'/>` +
    '</linearGradient></defs>' +
    `<rect width='512' height='512' rx='${cornerRadius}' ry='${cornerRadius}' fill='url(#fintrackBrand)'/>` +
    `<g transform='translate(${inset}, ${inset}) scale(${scale})'>` +
    "<polyline points='60,372 196,318 300,346 452,206' fill='none' stroke='#34d399' stroke-width='40' stroke-linecap='round' stroke-linejoin='round'/>" +
    "<path d='M 205 385 L 205 145 L 320 145' fill='none' stroke='#ffffff' stroke-width='52' stroke-linecap='round' stroke-linejoin='round'/>" +
    "<line x1='205' y1='265' x2='295' y2='265' stroke='#ffffff' stroke-width='52' stroke-linecap='round'/>" +
    '</g></svg>'
  );
}

/** La misma marca como data-URI, lista para `src` de un <img>. */
export function brandMarkDataUri(opts?: BrandMarkOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg(opts))}`;
}
