'use client';

import { useEffect, useState } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Header } from '@/components/layout/Header';
import { NavigationTabs } from '@/components/layout/NavigationTabs';
import { MobileNav } from '@/components/layout/MobileNav';
import { PullToRefresh } from '@/components/PullToRefresh';
import { DeleteConfirmModal } from '@/components/modals/DeleteConfirmModal';
import { DebtConfirmModal } from '@/components/modals/DebtConfirmModal';
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
import { OverviewSkeleton } from '@/components/skeletons/OverviewSkeleton';

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
    itemToDelete,
    debtConfirmData,
    reloadData,
    isInitialLoading,
    isRefreshingData
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
    itemToDelete ||
    Boolean(debtConfirmData)
  );

  // Bloqueo de scroll en segundo plano mientras haya un modal activo.
  // Fija el body EXACTAMENTE en su posición de scroll (position: fixed + top
  // negativo) y la restaura al cerrar. Así el fondo no salta ni se desliza al
  // abrir el modal, algo que sí pasa con solo overflow:hidden en iOS standalone.
  useEffect(() => {
    if (!isAnyModalOpen) return;

    const scrollY = window.scrollY;
    const { body } = document;
    // Al fijar el body desaparece la barra de scroll; compensamos su ancho con
    // padding para que el contenido de escritorio no se corra hacia los lados.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.classList.add('modal-open');
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.classList.remove('modal-open');
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.paddingRight = '';
      window.scrollTo(0, scrollY);
    };
  }, [isAnyModalOpen]);

  // Cada pestaña se ve desde su inicio: al cambiar de tab reiniciamos el scroll
  // arriba, en lugar de heredar el desplazamiento de la pestaña anterior.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Blur de la barra de estado (PWA en iOS): solo molesta arriba del todo, donde
  // no hay contenido que justifique el blur. Mientras estamos arriba tapamos esa
  // franja con un color solido; al hacer scroll la destapamos para que el
  // contenido pase bajo la barra con su blur natural (eso al usuario si le gusta).
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY <= 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Con un modal abierto ajustamos el overlay al viewport visible SOLO cuando el
  // teclado esta realmente abierto (overlap grande). Si no, lo dejamos FIJO a
  // pantalla completa. Clave: asi la barra de direcciones de Safari mostrandose/
  // ocultandose y el rebote (overscroll) al deslizar NO mueven el modal, que era
  // justo el bug. El teclado se detecta por un overlap > umbral, ignorando el
  // ruido pequeno de la barra/rebote.
  useEffect(() => {
    if (!isAnyModalOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const KB_THRESHOLD = 140; // px; el teclado tapa mucho mas que la barra/rebote

    const sync = () => {
      const overlap = window.innerHeight - vv.height - vv.offsetTop;
      if (overlap > KB_THRESHOLD) {
        // Teclado abierto: seguimos el rectangulo visible exacto (sin hueco).
        root.style.setProperty('--kb-vv-top', `${Math.round(vv.offsetTop)}px`);
        root.style.setProperty('--kb-vv-h', `${Math.round(vv.height)}px`);
      } else {
        // Sin teclado: overlay fijo a pantalla completa, estable ante scroll,
        // barra de direcciones y rebote (no se mueve al deslizar).
        root.style.setProperty('--kb-vv-top', '0px');
        root.style.setProperty('--kb-vv-h', '100dvh');
      }
    };
    sync();

    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      root.style.removeProperty('--kb-vv-h');
      root.style.removeProperty('--kb-vv-top');
    };
  }, [isAnyModalOpen]);

  return (
    <div className="dashboard-container">
      {/* Tapa de la franja de la barra de estado, solo visible arriba del todo:
          evita el blur del borde superior sin quitar el blur al hacer scroll. */}
      <div className={`status-bar-cover ${atTop ? 'is-visible' : ''}`} aria-hidden="true" />

      {/* Pull-to-refresh (movil): tiron hacia abajo estando arriba recarga la
          vista. Se desactiva con un modal abierto para no interferir. */}
      <PullToRefresh onRefresh={reloadData} disabled={isAnyModalOpen} />

      {/* Línea luminosa superior durante la recarga en vivo (stale-while-revalidate) */}
      {isRefreshingData && <div className="refresh-progress-line" aria-hidden="true" />}

      {/* 1. HEADER MODULAR CON CONTEXTO TEMPORAL GLOBAL */}
      <Header />

      {/* 2. NAVEGACIÓN DESKTOP CON TABS Y URL DEEP LINKING */}
      <NavigationTabs />

      {/* =========================================================================
          CONTENIDO DINÁMICO SEGÚN PESTAÑA MODULAR
          ========================================================================= */}
      <div className={`tab-content-wrapper ${isRefreshingData ? 'is-refreshing-stale' : ''}`}>
        {isInitialLoading ? (
          <OverviewSkeleton />
        ) : (
          <>
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
          </>
        )}
      </div>

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

      {/* 3.7 MODAL DE CONFIRMACIÓN DE ABONO / COBRO DE DEUDA O PRÉSTAMO */}
      {debtConfirmData && <DebtConfirmModal />}

      {/* 4. NAVEGACIÓN MÓVIL MODULAR */}
      <MobileNav />
    </div>
  );
}
