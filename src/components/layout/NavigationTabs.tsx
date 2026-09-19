'use client';

import React from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { NAVIGATION_TABS } from '@/config/navigationTabs';

export const NavigationTabs: React.FC = () => {
  const {
    activeTab,
    setActiveTab: onSelectTab,
    salaries,
    currentOtherIncomes,
    monthMovementsTotal: movementsCount,
    paymentMethods,
    receivables,
    payables,
    aiAnomalies
  } = useFinance();
  const salariesCount = salaries.length;
  const otherIncomesCount = currentOtherIncomes.length;
  const cardsCount = paymentMethods.length;
  const pendingReceivablesCount = receivables.filter(r => r.remainingAmount > 0).length;
  const pendingPayablesCount = payables.filter(p => p.remainingAmount > 0).length;
  const totalIncomesCount = salariesCount + otherIncomesCount;
  const totalPendingLoans = pendingReceivablesCount + pendingPayablesCount;
  const anomalyCount = aiAnomalies.length;

  const getTabLabel = (tabId: string, baseLabel: string) => {
    switch (tabId) {
      case 'transactions':
        return `${baseLabel} • ${movementsCount}`;
      case 'incomes':
        return `${baseLabel} • ${totalIncomesCount}`;
      case 'cards':
        return `${baseLabel} • ${cardsCount}`;
      case 'receivables':
        return `${baseLabel} • ${totalPendingLoans}`;
      default:
        return baseLabel;
    }
  };

  const getTabTooltip = (tabId: string, baseTooltip: string) => {
    switch (tabId) {
      case 'transactions':
        return `Movimientos: Gastos, pagos de tarjeta, ingresos y pagos de deuda del mes • ${movementsCount}`;
      case 'incomes':
        return `Ingresos: Sueldos y otros ingresos • ${totalIncomesCount}`;
      case 'cards':
        return `Tarjetas & Cuentas: Débito y líneas de crédito • ${cardsCount}`;
      case 'receivables':
        return `Préstamos & Deudas: Me Deben y Yo Debo • ${totalPendingLoans} pendientes`;
      default:
        return baseTooltip;
    }
  };

  return (
    <nav className="desktop-tabs-bar desktop-only">
      {NAVIGATION_TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`tab-button ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            title={getTabTooltip(tab.id, tab.tooltip)}
          >
            <Icon size={15} />
            <span>{getTabLabel(tab.id, tab.labelDesktop)}</span>
            {tab.id === 'analysis' && anomalyCount > 0 && (
              <span
                className="tab-alert-badge"
                title={`${anomalyCount} ${anomalyCount === 1 ? 'alerta de auditoría' : 'alertas de auditoría'}`}
              >
                {anomalyCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
