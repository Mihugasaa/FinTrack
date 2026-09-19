'use client';

import React from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { BOTTOM_NAV_TABS, MORE_MENU_TABS } from '@/config/navigationTabs';

export const MobileNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab: onSelectTab,
    isMoreMenuOpen,
    setIsMoreMenuOpen,
    receivables,
    payables,
    aiAnomalies,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const pendingReceivablesCount = receivables.filter(r => r.remainingAmount > 0).length;
  const pendingPayablesCount = payables.filter(p => p.remainingAmount > 0).length;
  const totalPendingLoans = pendingReceivablesCount + pendingPayablesCount;
  const anomalyCount = aiAnomalies.length;
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose: () => setIsMoreMenuOpen(false) });

  const isMoreTabActive = MORE_MENU_TABS.some(t => t.id === activeTab) || isMoreMenuOpen;

  return (
    <>
      {/* NAVEGACIÓN MÓVIL (BARRA INFERIOR FIJA - THUMB ZONE) */}
      <nav className="mobile-bottom-nav mobile-only">
        {BOTTOM_NAV_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id && !isMoreMenuOpen;
          return (
            <button
              key={tab.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                onSelectTab(tab.id);
                setIsMoreMenuOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{tab.labelMobile}</span>
            </button>
          );
        })}

        <button
          id="btn-mobile-more"
          className={`mobile-nav-item ${isMoreTabActive ? 'active' : ''}`}
          onClick={() => setIsMoreMenuOpen(prev => !prev)}
        >
          <MoreHorizontal size={18} />
          <span>Más</span>
          {(totalPendingLoans > 0 || anomalyCount > 0) && <span className="mobile-nav-badge" />}
        </button>
      </nav>

      {/* MODAL / BOTTOM SHEET "MÁS" PARA VISTAS SECUNDARIAS EN MÓVIL */}
      {isMoreMenuOpen && (
        <div
          className="modal-overlay mobile-only"
          onMouseDown={handleBackdropMouseDown}
          onClick={handleBackdropClick(() => setIsMoreMenuOpen(false))}
          onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
        >
          <div className="modal-box" ref={modalBoxRef} onClick={e => e.stopPropagation()}>
            <div className="modal-drag-zone" {...dragHandleProps}>
              <div className="modal-drag-handle" />
            </div>
            <div className="modal-header">
              <h3 className="modal-title">Más Opciones y Vistas</h3>
              <button className="modal-close-btn" onClick={() => setIsMoreMenuOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="more-menu-sheet">
              {MORE_MENU_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`more-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelectTab(tab.id);
                      setIsMoreMenuOpen(false);
                    }}
                  >
                    <div className="more-item-left">
                      <Icon size={18} className="text-brand" />
                      <div>
                        <div>{tab.labelMobile}</div>
                        {tab.mobileSubtitle && (
                          <div className="text-body-sm text-muted">{tab.mobileSubtitle}</div>
                        )}
                      </div>
                    </div>
                    {tab.id === 'receivables' && totalPendingLoans > 0 && (
                      <span className="badge badge-warning">
                        {totalPendingLoans} pendientes
                      </span>
                    )}
                    {tab.id === 'analysis' && anomalyCount > 0 && (
                      <span className="badge badge-danger">
                        {anomalyCount} {anomalyCount === 1 ? 'alerta' : 'alertas'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
