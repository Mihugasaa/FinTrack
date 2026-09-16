'use client';

import React, { useRef, useCallback, useEffect } from 'react';

interface UseSwipeToDismissOptions {
  onClose: () => void;
  threshold?: number;
}

/**
 * Hook para arrastrar la hoja hacia abajo (swipe-to-dismiss) desde el asa /
 * cabecera del modal en móvil. Solo se activa con un toque que EMPIEZA en el asa
 * (`dragHandleProps` se aplica a `.modal-drag-zone`), así que no interfiere con
 * el scroll interno del contenido ni con el fondo. Se aplican estilos `touchAction: 'none'`
 * y limpieza rigurosa de timers para evitar saltos y memory leaks.
 */
export function useSwipeToDismiss({ onClose, threshold = 85 }: UseSwipeToDismissOptions) {
  const modalBoxRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number>(0);
  const deltaYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const resetStyles = useCallback(() => {
    const el = modalBoxRef.current;
    if (!el) return;
    clearTimers();
    el.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
    el.style.transform = '';
    el.style.opacity = '';
    resetTimerRef.current = setTimeout(() => {
      if (el) {
        el.style.transition = '';
      }
      resetTimerRef.current = null;
    }, 250);
  }, [clearTimers]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    clearTimers();
    isDraggingRef.current = true;
    startYRef.current = e.touches[0].clientY;
    deltaYRef.current = 0;

    const el = modalBoxRef.current;
    if (el) {
      el.style.transition = 'none';
    }
  }, [clearTimers]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    deltaYRef.current = deltaY;

    const el = modalBoxRef.current;
    if (!el) return;

    if (deltaY > 0) {
      // Arrastre hacia abajo: sigue el dedo 1:1 con ligera reducción de opacidad progresiva
      el.style.transform = `translateY(${deltaY}px)`;
      const opacity = Math.max(0.5, 1 - deltaY / 450);
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
      // Superó el umbral: animar salida hacia abajo y disparar cierre
      if (el) {
        el.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease';
        el.style.transform = 'translateY(100%)';
        el.style.opacity = '0';
      }
      clearTimers();
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        onClose();
      }, 190);
    } else {
      // No superó el umbral: volver elásticamente a su posición original
      resetStyles();
    }
  }, [onClose, threshold, resetStyles, clearTimers]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      clearTimers();
      if (modalBoxRef.current) {
        modalBoxRef.current.style.transform = '';
        modalBoxRef.current.style.opacity = '';
        modalBoxRef.current.style.transition = '';
      }
    };
  }, [clearTimers]);

  return {
    modalBoxRef,
    dragHandleProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
      style: {
        touchAction: 'none' as const,
        userSelect: 'none' as const
      }
    }
  };
}
