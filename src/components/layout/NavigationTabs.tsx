'use client';

import React from 'react';
import {
  PieChart,
  Coins,
  ListFilter,
  CreditCard,
  Users,
  BarChart3,
  CheckCheck,
  Calendar
} from 'lucide-react';
import { ActiveTab } from '@/hooks/useTabNavigation';
import { useFinance } from '@/contexts/FinanceContext';

export const NavigationTabs: React.FC = () => {
  const {
    activeTab,
    setActiveTab: onSelectTab,
    salaries,
    currentOtherIncomes,
    monthMovementsTotal: movementsCount,
    paymentMethods,
    receivables,
    payables
  } = useFinance();
  const salariesCount = salaries.length;
  const otherIncomesCount = currentOtherIncomes.length;
  const cardsCount = paymentMethods.length;
  const pendingReceivablesCount = receivables.filter(r => r.remainingAmount > 0).length;
  const pendingPayablesCount = payables.filter(p => p.remainingAmount > 0).length;
  const totalIncomesCount = salariesCount + otherIncomesCount;
  const totalPendingLoans = pendingReceivablesCount + pendingPayablesCount;

  return (
    <nav className="desktop-tabs-bar desktop-only">
      <button
        id="tab-overview"
        className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
        onClick={() => onSelectTab('overview')}
        title="Visión General: Resumen financiero y métricas clave"
      >
        <PieChart size={15} />
        <span>Visión General</span>
      </button>

      <button
        id="tab-incomes"
        className={`tab-button ${activeTab === 'incomes' ? 'active' : ''}`}
        onClick={() => onSelectTab('incomes')}
        title={`Ingresos: Sueldos y otros ingresos • ${totalIncomesCount}`}
      >
        <Coins size={15} />
        <span>Ingresos • {totalIncomesCount}</span>
      </button>

      <button
        id="tab-transactions"
        className={`tab-button ${activeTab === 'transactions' ? 'active' : ''}`}
        onClick={() => onSelectTab('transactions')}
        title={`Movimientos: Gastos, pagos de tarjeta, ingresos y pagos de deuda del mes • ${movementsCount}`}
      >
        <ListFilter size={15} />
        <span>Movimientos • {movementsCount}</span>
      </button>

      <button
        id="tab-cards"
        className={`tab-button ${activeTab === 'cards' ? 'active' : ''}`}
        onClick={() => onSelectTab('cards')}
        title={`Tarjetas & Cuentas: Débito y líneas de crédito • ${cardsCount}`}
      >
        <CreditCard size={15} />
        <span>Tarjetas & Cuentas • {cardsCount}</span>
      </button>

      <button
        id="tab-receivables"
        className={`tab-button ${activeTab === 'receivables' ? 'active' : ''}`}
        onClick={() => onSelectTab('receivables')}
        title={`Préstamos & Deudas: Me Deben y Yo Debo • ${totalPendingLoans} pendientes`}
      >
        <Users size={15} />
        <span>Préstamos & Deudas • {totalPendingLoans}</span>
      </button>

      <button
        id="tab-analytics"
        className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
        onClick={() => onSelectTab('analytics')}
        title="Analítica & IA: Comparativas mensuales y simulador de flujo predictivo"
      >
        <BarChart3 size={15} />
        <span>Analítica & IA</span>
      </button>

      <button
        id="tab-reconciliation"
        className={`tab-button ${activeTab === 'reconciliation' ? 'active' : ''}`}
        onClick={() => onSelectTab('reconciliation')}
        title="Conciliación: Auditoría y cuadre de saldos"
      >
        <CheckCheck size={15} />
        <span>Conciliación</span>
      </button>

      <button
        id="tab-annual"
        className={`tab-button ${activeTab === 'annual' ? 'active' : ''}`}
        onClick={() => onSelectTab('annual')}
        title="Resumen Anual: Matriz anual consolidada estilo Excel"
      >
        <Calendar size={15} />
        <span>Resumen Anual</span>
      </button>
    </nav>
  );
};
