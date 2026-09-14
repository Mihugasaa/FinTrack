'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  // Si no cabe hacia abajo (modal alto cerca del borde), el popover abre hacia arriba.
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const POPOVER_HEIGHT = 380; // alto aprox. del calendario
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUp(spaceBelow < POPOVER_HEIGHT && spaceAbove > spaceBelow);
      }
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

  // Click outside y tecla Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

      {/* Popover Calendario Estilizado */}
      {isOpen && (
        <div className={`custom-date-picker-popover ${openUp ? 'open-up' : ''}`} role="dialog" aria-modal="true">
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
        </div>
      )}
    </div>
  );
};
