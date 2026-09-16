'use client';

import { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => void;
  disabled?: boolean;
}

const THRESHOLD = 70;   // px de tiron (ya con resistencia) para disparar
const MAX_PULL = 110;   // tope del indicador
const RESISTANCE = 0.5; // el indicador avanza a la mitad del dedo
const REFRESH_MS = 900; // cuanto se muestra el spinner tras disparar

const C = 56.5; // circunferencia del arco (r=9)

/**
 * Pull-to-refresh para movil: estando arriba del todo, un tiron hacia abajo
 * recarga los datos de la vista (todas las pestanas). En iOS instalado no hay
 * gesto nativo, por eso se implementa aqui. Solo se activa con toque, en el top
 * y con arrastre claramente vertical, para no pelear con el scroll ni los taps.
 */
export function PullToRefresh({ onRefresh, disabled = false }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false); // dedo abajo empezando en el top
  const active = useRef(false);   // gesto reconocido como tiron vertical
  const distRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (disabled) return;

    const getScrollTop = () => {
      return Math.max(
        window.scrollY || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0
      );
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (e.touches.length !== 1 || getScrollTop() > 3) {
        tracking.current = false;
        return;
      }
      tracking.current = true;
      active.current = false;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      setSettling(false);
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking.current || refreshingRef.current) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (!active.current) {
        // Aun decidiendo: si ya no estamos arriba, si va hacia arriba o si el
        // gesto es mas horizontal que vertical, soltamos (es scroll o swipe).
        if (getScrollTop() > 3 || Math.abs(dx) > Math.abs(dy) || dy < -4) {
          tracking.current = false;
          return;
        }
        if (dy > 8) active.current = true;
        else return;
      }

      const dist = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
      distRef.current = dist;
      setPull(dist);
      // Frenamos el rebote nativo del top mientras tiramos.
      if (e.cancelable) e.preventDefault();
    };

    const finish = () => {
      if (!tracking.current || refreshingRef.current) return;
      tracking.current = false;
      const triggered = active.current && distRef.current >= THRESHOLD;
      active.current = false;

      if (triggered) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        onRefreshRef.current();
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setSettling(true);
          setPull(0);
          distRef.current = 0;
          window.setTimeout(() => setSettling(false), 220);
        }, REFRESH_MS);
      } else {
        setSettling(true);
        setPull(0);
        distRef.current = 0;
        window.setTimeout(() => setSettling(false), 220);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', finish, { passive: true });
    window.addEventListener('touchcancel', finish, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', finish);
      window.removeEventListener('touchcancel', finish);
    };
  }, [disabled]);

  const y = refreshing ? THRESHOLD : pull;
  const progress = Math.min(1, y / THRESHOLD);

  return (
    <div
      className="ptr-indicator"
      aria-hidden={y === 0 && !refreshing}
      style={{
        transform: `translateX(-50%) translateY(${y}px)`,
        opacity: refreshing ? 1 : progress,
        transition: settling ? 'transform 0.2s ease, opacity 0.2s ease' : 'none',
      }}
    >
      <svg
        className={refreshing ? 'ptr-spin' : undefined}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        style={{ transform: refreshing ? undefined : `rotate(${-90 + progress * 120}deg)` }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={refreshing ? `${C * 0.72} ${C}` : `${progress * C} ${C}`}
          transform="rotate(-90 12 12)"
        />
      </svg>
    </div>
  );
}
