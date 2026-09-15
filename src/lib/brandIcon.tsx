// Elemento del ícono de marca para next/og ImageResponse (favicon, PWA, apple-touch).
// F GEOMÉTRICA (barras redondeadas, como en el preview), blanca y centrada, con la
// línea verde de tendencia detrás, sobre el gradiente morado. Se dibuja con divs
// posicionados (no con la fuente del sistema) para que la tipografía sea la elegida.
// Coordenadas base en 512 escaladas a cualquier tamaño.

const TREND_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
  "<polyline points='60,372 196,318 300,346 452,206' fill='none' stroke='#34d399' " +
  "stroke-width='38' stroke-linecap='round' stroke-linejoin='round'/></svg>";

export function brandIconElement(px: number) {
  const s = px / 512;
  const r = (n: number) => Math.round(n * s);

  // F geométrica centrada (bbox 181..331 x, 136..376 y en base 512).
  const x = r(181);
  const topY = r(136);
  const stemW = r(60);
  const barH = r(60);
  const topW = r(150);
  const midY = r(226);
  const midW = r(115);
  const midH = r(50);
  const stemH = r(240);
  const rad = r(15);

  const stroke = { position: 'absolute' as const, background: '#ffffff', borderRadius: rad };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      }}
    >
      <img
        width={px}
        height={px}
        src={`data:image/svg+xml,${encodeURIComponent(TREND_SVG)}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      <div style={{ ...stroke, left: x, top: topY, width: stemW, height: stemH }} />
      <div style={{ ...stroke, left: x, top: topY, width: topW, height: barH }} />
      <div style={{ ...stroke, left: x, top: midY, width: midW, height: midH }} />
    </div>
  );
}
