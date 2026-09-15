// Marca FinTrack en una sola fuente de verdad. Concepto: un anillo (el ciclo de
// facturacion que se repite mes a mes) con un corte limpio, y un punto central
// (la fecha real en que el dinero se mueve). Plano, sin gradiente, un solo acento.
// La usan el favicon/PWA y el apple-icon. El logo del header se dibuja aparte como
// SVG en linea (FinTrackLogo) para poder cambiar de color con el tema.

export const BRAND_INK = '#0f172a';
export const BRAND_INDIGO = '#4f46e5';
export const BRAND_INDIGO_BRIGHT = '#6366f1';

interface BrandMarkOptions {
  // Radio de esquina en unidades del lienzo 512 (0 = cuadrado a sangre, ideal
  // para iconos instalables porque el SO aplica su propia mascara redondeada).
  cornerRadius?: number;
  // Padding interno de la marca en unidades de 512 (zona segura para mascaras
  // maskable de Android). 0 = la marca ocupa todo el lienzo.
  inset?: number;
  // Color del campo (fondo del icono).
  bg?: string;
  // Color del anillo.
  ring?: string;
  // Color del punto central.
  dot?: string;
}

/**
 * SVG completo del icono de marca (campo + anillo con corte + punto), listo para
 * incrustar como data-URI o como imagen de ImageResponse. Por defecto rinde el
 * icono primario: anillo blanco y punto indigo sobre campo tinta.
 */
export function brandMarkSvg({
  cornerRadius = 0,
  inset = 0,
  bg = BRAND_INK,
  ring = '#ffffff',
  dot = BRAND_INDIGO_BRIGHT,
}: BrandMarkOptions = {}): string {
  const scale = (512 - inset * 2) / 512;
  return (
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
    `<rect width='512' height='512' rx='${cornerRadius}' ry='${cornerRadius}' fill='${bg}'/>` +
    `<g transform='translate(${inset}, ${inset}) scale(${scale})'>` +
    `<g transform='rotate(-52 256 256)'>` +
    `<circle cx='256' cy='256' r='162' fill='none' stroke='${ring}' stroke-width='55' stroke-linecap='round' stroke-dasharray='874 144'/>` +
    '</g>' +
    `<circle cx='256' cy='256' r='47' fill='${dot}'/>` +
    '</g></svg>'
  );
}

/** La misma marca como data-URI, lista para `src` de un <img>. */
export function brandMarkDataUri(opts?: BrandMarkOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(brandMarkSvg(opts))}`;
}
