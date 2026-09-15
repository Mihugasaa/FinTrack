'use client';

import { useRef, useCallback, useEffect } from 'react';

interface UseSwipeToDismissOptions {
  onClose: () => void;
  threshold?: number;
}

/**
 * Hook para soportar el gesto de arrastrar hacia abajo (swipe-to-dismiss)
 * desde el drag-handle o cabecera del modal en dispositivos móviles.
 */
export function useSwipeToDismiss({ onClose, threshold = 85 }: UseSwipeToDismissOptions) {
  const modalBoxRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number>(0);
  const deltaYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  const resetStyles = useCallback(() => {
    const el = modalBoxRef.current;
    if (!el) return;
    el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
    el.style.transform = '';
    el.style.opacity = '';
    setTimeout(() => {
      if (el) {
        el.style.transition = '';
      }
    }, 250);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDraggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    deltaYRef.current = 0;

    const el = modalBoxRef.current;
    if (el) {
      el.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    deltaYRef.current = deltaY;

    const el = modalBoxRef.current;
    if (!el) return;

    if (deltaY > 0) {
      // Arrastre hacia abajo: sigue el dedo 1:1
      el.style.transform = `translateY(${deltaY}px)`;
      const opacity = Math.max(0.6, 1 - deltaY / 450);
      el.style.opacity = String(opacity);
    } else {
      // Resistencia elástica si se intenta subir
      el.style.transform = `translateY(${deltaY * 0.15}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const deltaY = deltaYRef.current;
    const el = modalBoxRef.current;

    if (deltaY > threshold) {
      // Superó el umbral: animar salida hacia abajo y cerrar
      if (el) {
        el.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease';
        el.style.transform = 'translateY(100%)';
        el.style.opacity = '0';
      }
      setTimeout(() => {
        onClose();
      }, 190);
    } else {
      // No superó el umbral: volver elásticamente a su posición original
      resetStyles();
    }
  }, [onClose, threshold, resetStyles]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = '';
        modalBoxRef.current.style.opacity = '';
        modalBoxRef.current.style.transition = '';
      }
    };
  }, []);

  return {
    modalBoxRef,
    dragHandleProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd
    }
  };
}
