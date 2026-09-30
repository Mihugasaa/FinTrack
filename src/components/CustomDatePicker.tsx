'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // Formato YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  title?: string;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Seleccionar fecha...',
  id,
  className = '',
  disabled = false,
  minDate,
  maxDate,
  title
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; isMobile: boolean }>({
    top: 0,
    left: 0,
    isMobile: false
  });
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calcula posición flotante (Portal) en desktop y modo modal centrado en mobile
  const updatePosition = () => {
    if (!containerRef.current) return;
    const isMobile = window.innerWidth <= 640;
    if (isMobile) {
      setCoords({ top: 0, left: 0, isMobile: true });
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const POPOVER_HEIGHT = 355;
    const POPOVER_WIDTH = 320;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    // Si cabe abajo con holgura o hay más espacio abajo que arriba:
    if (spaceBelow >= POPOVER_HEIGHT || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
    } else {
      top = rect.top - POPOVER_HEIGHT - 6;
    }

    // Clamp vertical: que nunca se salga por arriba ni por abajo de la pantalla
    top = Math.max(12, Math.min(window.innerHeight - POPOVER_HEIGHT - 12, top));

    // Clamp horizontal: alineado a la izquierda del trigger, pero sin desbordar el ancho de pantalla
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - POPOVER_WIDTH - 12);
    }
    if (left < 12) left = 12;

    setCoords({ top, left, isMobile: false });
  };

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(prev => !prev);
  };

  // Inicializar año y mes a partir de value o fecha actual
  const getInitialView = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      return { year: y, month: m - 1 }; // 0-indexed month
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  };

  const [viewDate, setViewDate] = useState(getInitialView);

  // Sincronizar vista si cambia el valor externamente
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setViewDate({ year: y, month: m - 1 });
    }
  }, [value]);

  // Actualizar posición en resize o scroll (capture: true para capturar scroll de modales)
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Click outside y tecla Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  const handleSelectDay = (year: number, month: number, day: number) => {
    const mStr = (month + 1).toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    const formatted = `${year}-${mStr}-${dStr}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setViewDate({ year: now.getFullYear(), month: now.getMonth() });
    setIsOpen(false);
  };

  // Formatear texto visible en el input: ej. "29/08/2026 (29 de Agosto de 2026)"
  const formatDisplay = (val: string) => {
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return '';
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  };

  const formatLongDisplay = (val: string) => {
    if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) return '';
    const [y, m, d] = val.split('-');
    const mIdx = parseInt(m, 10) - 1;
    return `${parseInt(d, 10)} de ${MONTH_NAMES_ES[mIdx]} de ${y}`;
  };

  // Generar cuadrícula del mes
  const generateCalendarDays = () => {
    const { year, month } = viewDate;
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    // Días del mes anterior para rellenar
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${(prevMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        day: d,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        dateStr,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
        isDisabled: (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        day: d,
        month,
        year,
        isCurrentMonth: true,
        dateStr,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
        isDisabled: (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false
      });
    }

    // Días del mes siguiente para completar 35 o 42 celdas
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remainingCells; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${(nextMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        day: d,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        dateStr,
        isSelected: dateStr === value,
        isToday: dateStr === todayStr,
        isDisabled: (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate) || false
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const renderPopoverContent = () => (
    <>
      {/* Barra superior de mes/año y navegación */}
      <div className="date-picker-header">
        <button
          type="button"
          className="date-nav-btn"
          onClick={handlePrevMonth}
          title="Mes anterior"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="date-picker-month-title">
          {MONTH_NAMES_ES[viewDate.month]} {viewDate.year}
        </span>

        <button
          type="button"
          className="date-nav-btn"
          onClick={handleNextMonth}
          title="Mes siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="date-picker-weekdays">
        {WEEKDAY_NAMES_ES.map(wd => (
          <span key={wd} className="date-picker-weekday">
            {wd}
          </span>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="date-picker-grid">
        {calendarDays.map((item, idx) => (
          <button
            key={`${item.dateStr}-${idx}`}
            type="button"
            disabled={item.isDisabled}
            className={`date-picker-day ${
              item.isCurrentMonth ? 'current-month' : 'other-month'
            } ${item.isSelected ? 'selected' : ''} ${
              item.isToday ? 'today' : ''
            }`}
            onClick={() => !item.isDisabled && handleSelectDay(item.year, item.month, item.day)}
            title={item.dateStr}
          >
            <span>{item.day}</span>
          </button>
        ))}
      </div>

      {/* Barra inferior de accesos rápidos */}
      <div className="date-picker-footer">
        <button
          type="button"
          className="date-picker-quick-btn"
          onClick={handleSelectToday}
        >
          Ir a Hoy
        </button>
        {value && (
          <span className="date-picker-current-selected tabular-nums">
            {formatDisplay(value)}
          </span>
        )}
        <button
          type="button"
          className="date-picker-close-btn"
          onClick={() => setIsOpen(false)}
        >
          Listo
        </button>
      </div>
    </>
  );

  return (
    <div
      ref={containerRef}
      id={id}
      className={`custom-date-picker-container ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'disabled' : ''}`}
      title={title || (value ? formatLongDisplay(value) : undefined)}
    >
      {/* Botón Disparador estilo Input de Alta Fidelidad */}
      <button
        type="button"
        id={id ? `${id}-btn` : undefined}
        className={`custom-date-picker-trigger ${isOpen ? 'open' : ''}`}
        onClick={handleToggleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="custom-date-picker-display">
          <CalendarIcon size={16} className="date-picker-icon" />
          {value ? (
            <span className="custom-date-text tabular-nums">
              {formatDisplay(value)}
              <span className="custom-date-long-hint desktop-only">
                ({formatLongDisplay(value)})
              </span>
            </span>
          ) : (
            <span className="custom-date-placeholder">{placeholder}</span>
          )}
        </div>

        <span className="custom-date-action-badge">
          {isOpen ? 'Cerrar' : 'Elegir'}
        </span>
      </button>

      {/* Popover Calendario Estilizado Flotante via Portal fuera del Modal */}
      {isOpen && isMounted && typeof document !== 'undefined' && (
        createPortal(
          coords.isMobile ? (
            <div
              className="custom-date-picker-mobile-overlay"
              onClick={() => setIsOpen(false)}
            >
              <div
                ref={popoverRef}
                className="custom-date-picker-popover-portal is-mobile"
                role="dialog"
                aria-modal="true"
                onClick={e => e.stopPropagation()}
              >
                {renderPopoverContent()}
              </div>
            </div>
          ) : (
            <div
              ref={popoverRef}
              className="custom-date-picker-popover-portal"
              style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`
              }}
              role="dialog"
              aria-modal="true"
              onClick={e => e.stopPropagation()}
            >
              {renderPopoverContent()}
            </div>
          ),
          document.body
        )
      )}
    </div>
  );
};
