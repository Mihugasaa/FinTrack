'use client';

import React from 'react';
import {
  PieChart,
  ListFilter,
  Coins,
  CreditCard,
  MoreHorizontal,
  X,
  Users,
  Calendar,
  TrendingUp,
  CheckCheck,
  LogOut
} from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';

export const MobileNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab: onSelectTab,
    isMoreMenuOpen,
    setIsMoreMenuOpen,
    receivables,
    payables,
    currentUser,
    handleLogout,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const pendingReceivablesCount = receivables.filter(r => r.remainingAmount > 0).length;
  const pendingPayablesCount = payables.filter(p => p.remainingAmount > 0).length;
  const totalPendingLoans = pendingReceivablesCount + pendingPayablesCount;

  return (
    <>
      {/* NAVEGACIÓN MÓVIL (BARRA INFERIOR FIJA - THUMB ZONE) */}
      <nav className="mobile-bottom-nav mobile-only">
        <button
          className={`mobile-nav-item ${activeTab === 'overview' && !isMoreMenuOpen ? 'active' : ''}`}
          onClick={() => {
            onSelectTab('overview');
            setIsMoreMenuOpen(false);
          }}
        >
          <PieChart size={18} />
          <span>Inicio</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'transactions' && !isMoreMenuOpen ? 'active' : ''}`}
          onClick={() => {
            onSelectTab('transactions');
            setIsMoreMenuOpen(false);
          }}
        >
          <ListFilter size={18} />
          <span>Gastos</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'incomes' && !isMoreMenuOpen ? 'active' : ''}`}
          onClick={() => {
            onSelectTab('incomes');
            setIsMoreMenuOpen(false);
          }}
        >
          <Coins size={18} />
          <span>Ingresos</span>
        </button>

        <button
          className={`mobile-nav-item ${activeTab === 'cards' && !isMoreMenuOpen ? 'active' : ''}`}
          onClick={() => {
            onSelectTab('cards');
            setIsMoreMenuOpen(false);
          }}
        >
          <CreditCard size={18} />
          <span>Tarjetas</span>
        </button>

        <button
          id="btn-mobile-more"
          className={`mobile-nav-item ${(activeTab === 'receivables' || activeTab === 'annual' || isMoreMenuOpen) ? 'active' : ''}`}
          onClick={() => setIsMoreMenuOpen(prev => !prev)}
        >
          <MoreHorizontal size={18} />
          <span>Más</span>
          {totalPendingLoans > 0 && <span className="mobile-nav-badge" />}
        </button>
      </nav>

      {/* MODAL / BOTTOM SHEET "MÁS" PARA VISTAS SECUNDARIAS EN MÓVIL */}
      {isMoreMenuOpen && (
        <div
          className="modal-overlay mobile-only"
          onMouseDown={handleBackdropMouseDown}
          onClick={handleBackdropClick(() => setIsMoreMenuOpen(false))}
        >
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-drag-handle" />
            <div className="modal-header">
              <h3 className="modal-title">Más Opciones y Vistas</h3>
              <button className="modal-close-btn" onClick={() => setIsMoreMenuOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="more-menu-sheet">
              <button
                className={`more-menu-item ${activeTab === 'receivables' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('receivables');
                  setIsMoreMenuOpen(false);
                }}
              >
                <div className="more-item-left">
                  <Users size={18} className="text-brand" />
                  <div>
                    <div>Préstamos y Deudas</div>
                    <div className="text-body-sm text-muted">Dinero prestado y deudas mías</div>
                  </div>
                </div>
                {totalPendingLoans > 0 && (
                  <span className="badge badge-warning">
                    {totalPendingLoans} pendientes
                  </span>
                )}
              </button>

              <button
                className={`more-menu-item ${activeTab === 'annual' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('annual');
                  setIsMoreMenuOpen(false);
                }}
              >
                <div className="more-item-left">
                  <Calendar size={18} className="text-brand" />
                  <div>
                    <div>Resumen Anual</div>
                    <div className="text-body-sm text-muted">Matriz de gastos anual completa</div>
                  </div>
                </div>
              </button>

              <button
                className={`more-menu-item ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('analytics');
                  setIsMoreMenuOpen(false);
                }}
              >
                <div className="more-item-left">
                  <TrendingUp size={18} className="text-brand" />
                  <div>
                    <div>Analítica & Forecast IA</div>
                    <div className="text-body-sm text-muted">Proyección 3-6 meses y auditoría ML</div>
                  </div>
                </div>
              </button>

              <button
                className={`more-menu-item ${activeTab === 'reconciliation' ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab('reconciliation');
                  setIsMoreMenuOpen(false);
                }}
              >
                <div className="more-item-left">
                  <CheckCheck size={18} className="text-brand" />
                  <div>
                    <div>Conciliación Bancaria</div>
                    <div className="text-body-sm text-muted">Comparar estado de cuenta con app</div>
                  </div>
                </div>
              </button>

              <button
                id="btn-logout-mobile"
                className="more-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  handleLogout();
                }}
                style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px' }}
              >
                <div className="more-item-left">
                  <LogOut size={18} color="var(--accent-danger)" />
                  <div>
                    <div style={{ color: 'var(--accent-danger)' }}>Cerrar Sesión</div>
                    <div className="text-body-sm text-muted">@{currentUser?.username}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
