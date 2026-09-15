'use client';

import React from 'react';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

export const Header: React.FC = () => {
  const {
    isCurrentActiveMonth,
    isPastMonth,
    currentMonth,
    currentYear,
    monthNames,
    monthPickerRef,
    isMonthDropdownOpen,
    setIsMonthDropdownOpen,
    handleGoToCurrentMonth,
    handlePrevMonth,
    handleNextMonth,
    handleSelectMonth,
    debitStats,
    handleOpenCreateTransaction,
    theme,
    toggleTheme,
    currentUser,
    handleLogout,
    formatSoles
  } = useFinance();
  const currentDebitBalance = isCurrentActiveMonth
    ? debitStats.currentDebitBalanceToday
    : debitStats.projectedDebitBalanceMonthEnd;
  return (
    <header className="dashboard-header">
      {/* Grupo Izquierdo: Logotipo y Contexto Temporal Global */}
      <div className="header-left-group">
        <div className="brand-section" title="FinTrack">
          <div className="brand-logo-mark">
            <Layers size={18} />
          </div>
          <span className="brand-text-title">FinTrack</span>
        </div>

        <div className="month-controls-group">
          <button
            className="month-today-btn"
            onClick={handleGoToCurrentMonth}
            disabled={isCurrentActiveMonth}
            title={isCurrentActiveMonth ? 'Ya te encuentras en el mes actual' : 'Ir al mes actual'}
          >
            Hoy
          </button>

          <div className="month-picker-bar" ref={monthPickerRef}>
            <button
              id="btn-prev-month"
              className="month-nav-btn"
              onClick={handlePrevMonth}
              title="Ir al mes anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              id="btn-month-picker"
              className="month-title-btn"
              onClick={() => setIsMonthDropdownOpen(prev => !prev)}
              title={`Mes seleccionado: ${monthNames[currentMonth]} ${currentYear} (Clic para desplegar selector de meses)`}
            >
              <span>{monthNames[currentMonth]} {currentYear}</span>
              <ChevronDown size={14} />
            </button>

            <button
              id="btn-next-month"
              className="month-nav-btn"
              onClick={handleNextMonth}
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>

            {/* Popover Selector de 12 Meses */}
            {isMonthDropdownOpen && (
              <div className="month-dropdown-menu clean-card">
                {monthNames.slice(1).map((mName, idx) => {
                  const mNum = idx + 1;
                  return (
                    <button
                      key={mNum}
                      className={`month-dropdown-item ${currentMonth === mNum ? 'active' : ''}`}
                      onClick={() => handleSelectMonth(mNum)}
                    >
                      {mName.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grupo Derecho: Saldo Hoy, Call To Action Principal y Perfil */}
      <div className="header-right-group">
        <div
          className="header-mini-pill"
          title={
            isCurrentActiveMonth
              ? 'Dinero líquido real disponible hoy'
              : isPastMonth
              ? `Saldo líquido de cierre en ${monthNames[currentMonth]} ${currentYear}`
              : `Saldo proyectado al cierre de ${monthNames[currentMonth]} ${currentYear}`
          }
        >
          <span className="mini-pill-label">
            {isCurrentActiveMonth
              ? 'Saldo Hoy:'
              : isPastMonth
              ? 'Saldo Cierre:'
              : 'Saldo Proyectado:'}
          </span>
          <strong className="mini-pill-val tabular-nums">
            {formatSoles(currentDebitBalance)}
          </strong>
        </div>

        <button
          id="btn-quick-add"
          className="btn-primary"
          onClick={handleOpenCreateTransaction}
          title="Registrar nuevo gasto o reembolso"
        >
          <Plus size={16} />
          <span>Registrar Gasto</span>
        </button>

        <div className="header-utility-actions">
          <button
            id="btn-theme-toggle"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {currentUser && (
            <div className="header-user-pill" title={`Sesión activa: @${currentUser.username} • ${currentUser.fullName}`}>
              <div className="user-avatar-badge">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <span className="user-name-text desktop-only">@{currentUser.username}</span>
              <button
                id="btn-logout-desktop"
                className="btn-logout-icon"
                onClick={handleLogout}
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
