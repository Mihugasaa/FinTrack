'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Navegación de mes/año del dashboard: estado del mes visible, el selector
 * desplegable y sus handlers (anterior, siguiente, hoy, elegir mes). Cierra el
 * desplegable al hacer clic fuera. Sin efectos secundarios de datos: la re-carga
 * al cambiar de mes vive en el componente, reaccionando a currentMonth/currentYear.
 */
export function useMonthNavigation() {
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1); // Septiembre = 9
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToCurrentMonth = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth() + 1);
    setIsMonthDropdownOpen(false);
  };

  const handleSelectMonth = (m: number) => {
    setCurrentMonth(m);
    setIsMonthDropdownOpen(false);
  };

  // Cerrar selector de meses al hacer clic fuera
  useEffect(() => {
    const handleClickOutsideMonthPicker = (e: MouseEvent) => {
      if (isMonthDropdownOpen && monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    if (isMonthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideMonthPicker);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMonthPicker);
    };
  }, [isMonthDropdownOpen]);

  return {
    currentYear,
    currentMonth,
    setCurrentYear,
    setCurrentMonth,
    isMonthDropdownOpen,
    setIsMonthDropdownOpen,
    monthPickerRef,
    handlePrevMonth,
    handleNextMonth,
    handleGoToCurrentMonth,
    handleSelectMonth
  };
}
