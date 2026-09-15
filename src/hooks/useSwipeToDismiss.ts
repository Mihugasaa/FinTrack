'use client';

import { useRef, type HTMLAttributes } from 'react';

interface UseSwipeToDismissOptions {
  onClose: () => void;
  threshold?: number;
}

/**
 * Swipe-para-cerrar DESACTIVADO a proposito.
 *
 * El gesto de arrastrar la hoja hacia abajo (desde la franja superior) hacia que
 * el modal se pudiera mover al deslizar cerca del borde y se sentia inestable.
 * Se retiro para que el modal quede FIJO: solo se cierra con la X, con Cancelar o
 * tocando fuera. Se conserva la firma del hook (modalBoxRef + dragHandleProps)
 * para no tener que editar los 11 modales; ahora dragHandleProps no ata ningun
 * manejador, asi que la franja superior es solo un asa decorativa que no mueve
 * nada.
 */
export function useSwipeToDismiss(_options: UseSwipeToDismissOptions) {
  const modalBoxRef = useRef<HTMLDivElement | null>(null);
  const dragHandleProps: HTMLAttributes<HTMLDivElement> = {};
  return { modalBoxRef, dragHandleProps };
}
