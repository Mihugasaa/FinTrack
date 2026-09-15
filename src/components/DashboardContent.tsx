'use client';

import { useEffect } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Header } from '@/components/layout/Header';
import { NavigationTabs } from '@/components/layout/NavigationTabs';
import { MobileNav } from '@/components/layout/MobileNav';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { AdjustDebitModal } from '@/components/modals/AdjustDebitModal';
import { IncomeModal } from '@/components/modals/IncomeModal';
import { SalaryModal } from '@/components/modals/SalaryModal';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { CollectModal } from '@/components/modals/CollectModal';
import { EditCardModal } from '@/components/modals/EditCardModal';
import { CardModal } from '@/components/modals/CardModal';
import { ReceivableModal } from '@/components/modals/ReceivableModal';
import { PayableModal } from '@/components/modals/PayableModal';
import { PayablePaymentModal } from '@/components/modals/PayablePaymentModal';
import { ExpenseModal } from '@/components/modals/ExpenseModal';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { IncomesTab } from '@/components/tabs/IncomesTab';
import { TransactionsTab } from '@/components/tabs/TransactionsTab';
import { CardsTab } from '@/components/tabs/CardsTab';
import { ReceivablesTab } from '@/components/tabs/ReceivablesTab';
import { AnalysisTab } from '@/components/tabs/AnalysisTab';
import { ReconciliationTab } from '@/components/tabs/ReconciliationTab';

/**
 * Maquetación del dashboard. Solo decide qué pestaña y qué modales están
 * visibles; todos los datos y handlers los obtiene cada hijo directamente del
 * FinanceContext vía useFinance(), por lo que aquí únicamente se leen los flags
 * de apertura y las condiciones de los guards.
 */
export function DashboardContent() {
  const {
    activeTab,
    isExpenseModalOpen,
    isAdjustDebitModalOpen,
    isEditCardModalOpen,
    isCollectModalOpen,
    collectingRec,
    collectingDebtorGroup,
    isIncomeModalOpen,
    isCardModalOpen,
    isPaymentModalOpen,
    isReceivableModalOpen,
    isPayableModalOpen,
    isPayablePaymentModalOpen,
    payingPayable,
    payingCreditorGroup,
    isSalaryModalOpen,
    itemToDelete
  } = useFinance();

  const isAnyModalOpen = Boolean(
    isExpenseModalOpen ||
    isAdjustDebitModalOpen ||
    isEditCardModalOpen ||
    (isCollectModalOpen && (collectingRec || collectingDebtorGroup)) ||
    isIncomeModalOpen ||
    isCardModalOpen ||
    isPaymentModalOpen ||
    isReceivableModalOpen ||
    isPayableModalOpen ||
    (isPayablePaymentModalOpen && (payingPayable || payingCreditorGroup)) ||
    isSalaryModalOpen ||
    itemToDelete
  );

  // Bloqueo de scroll en segundo plano mientras haya un modal activo
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isAnyModalOpen]);

  return (
    <div className="dashboard-container">
      {/* 1. HEADER MODULAR CON CONTEXTO TEMPORAL GLOBAL */}
      <Header />

      {/* 2. NAVEGACIÓN DESKTOP CON TABS Y URL DEEP LINKING */}
      <NavigationTabs />

      {/* =========================================================================
          CONTENIDO DINÁMICO SEGÚN PESTAÑA MODULAR
          ========================================================================= */}

      {/* PESTAÑA 1: VISIÓN GENERAL & GRÁFICOS */}
      {activeTab === 'overview' && <OverviewTab />}

      {/* PESTAÑA 2: INGRESOS & SUELDOS */}
      {activeTab === 'incomes' && <IncomesTab />}

      {/* PESTAÑA 3: MOVIMIENTOS COMPLETOS */}
      {activeTab === 'transactions' && <TransactionsTab />}

      {/* PESTAÑA 4: CUENTAS & TARJETAS (DÉBITO Y CRÉDITO) */}
      {activeTab === 'cards' && <CardsTab />}

      {/* PESTAÑA 5: PRÉSTAMOS Y DEUDAS */}
      {activeTab === 'receivables' && <ReceivablesTab />}

      {/* PESTAÑA 6: ANÁLISIS (Mes actual · Tendencia · Proyección) */}
      {activeTab === 'analysis' && <AnalysisTab />}

      {/* PESTAÑA 7: CONCILIACIÓN BANCARIA INTELIGENTE */}
      {activeTab === 'reconciliation' && <ReconciliationTab />}

      {/* =========================================================================
          MODALES DEL SISTEMA COMPLETO
          ========================================================================= */}

      {/* MODAL 1: REGISTRAR GASTO */}
      {isExpenseModalOpen && <ExpenseModal />}

      {/* MODAL 2: AJUSTAR SALDO DÉBITO INICIAL */}
      {isAdjustDebitModalOpen && <AdjustDebitModal />}

      {/* MODAL: EDITAR TARJETA / MEDIO DE PAGO */}
      {isEditCardModalOpen && <EditCardModal />}

      {/* MODAL: REGISTRAR ABONO O COBRO PARCIAL A PRÉSTAMO */}
      {isCollectModalOpen && (collectingRec || collectingDebtorGroup) && <CollectModal />}

      {/* MODAL 3: REGISTRAR INGRESO EXTRA A DÉBITO */}
      {isIncomeModalOpen && <IncomeModal />}

      {/* MODAL 4: NUEVA TARJETA PERSONALIZADA */}
      {isCardModalOpen && <CardModal />}

      {/* MODAL 5: REGISTRAR O MODIFICAR ABONO / PAGO A TARJETA */}
      {isPaymentModalOpen && <PaymentModal />}

      {/* MODAL 6: NUEVA CUENTA POR COBRAR */}
      {isReceivableModalOpen && <ReceivableModal />}

      {/* MODAL 6B: REGISTRAR DEUDA MÍA (DINERO PRESTADO) */}
      {isPayableModalOpen && <PayableModal />}

      {/* MODAL 6C: REGISTRAR PAGO / AMORTIZACIÓN DE DEUDA MÍA */}
      {isPayablePaymentModalOpen && (payingPayable || payingCreditorGroup) && <PayablePaymentModal />}

      {/* 11. MODAL: CONFIGURAR SUELDO / NÓMINA */}
      {isSalaryModalOpen && <SalaryModal />}

      {/* 3.6 MODAL DE CONFIRMACIÓN DE ELIMINACIÓN SEGURA */}
      {itemToDelete && <DeleteConfirmModal />}

      {/* 4. NAVEGACIÓN MÓVIL MODULAR */}
      <MobileNav />
    </div>
  );
}
