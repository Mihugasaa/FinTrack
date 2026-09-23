'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTabNavigation } from '@/hooks/useTabNavigation';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';
import { useTheme } from '@/hooks/useTheme';
import { useReconciliation } from '@/hooks/useReconciliation';
import { useIncomes } from '@/hooks/useIncomes';
import { useCardPayments } from '@/hooks/useCardPayments';
import { useReceivables } from '@/hooks/useReceivables';
import { usePayables } from '@/hooks/usePayables';
import { useTransactions } from '@/hooks/useTransactions';
import { AuthService, UserProfile } from '@/services/auth.service';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { AIIntelligenceService } from '@/services/aiIntelligence.service';
import {
  initialCategories,
  initialPaymentMethods
} from '@/lib/defaults';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';
import { generateUUID, resolvePaymentMethod, deduplicateTransactions } from '@/lib/utils';
import { DebtConfirmData } from '@/types';
import {
  getBestCardRecommendation,
  calculateMonthlyDiagnostic,
  calculateCardsDebtSummary,
  calculateCurrentDebitBalance,
  computeMonthlyDebitChain,
  getReceivableCollectionMonth,
  computeFinancialHealthScore,
  formatDisplayDate,
  formatSoles,
  getEffectiveDayOfMonth,
  getEndOfMonthDate,
  getFallbackReceivablePaymentDate
} from '@/lib/calculations';
import {
  Transaction,
  PaymentMethod,
  CardPayment
} from '@/types';

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ==============================================================================
// CONTROLADOR MAESTRO DE FINANZAS
// Toda la orquestación del dashboard (estado, hooks de dominio, efectos de
// sincronización con Supabase, cálculos derivados y handlers) vive aquí. El
// componente `DashboardContent` y los tabs/modales consumen este estado vía
// `useFinance()`, eliminando el prop-drilling que antes cruzaba `page.tsx`.
// ==============================================================================
function useFinanceController() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // 1. Tema Claro / Oscuro (Predeterminado: Claro)
  const { theme, toggleTheme } = useTheme();

  // Estados de carga (Esqueleto inicial y Refresco en vivo)
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  // Nonce de recarga: al subir, re-dispara todos los loaders de datos (pull-to-
  // refresh) sin recargar la pagina, conservando mes, pestana y scroll.
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    // Autenticación basada en la SESIÓN de Supabase (fuente de verdad), no solo en
    // localStorage: así el PWA instalado (con cookie válida pero sin localStorage) no
    // cae en el loop /→/login→/. Solo se manda a /login si no hay sesión real.
    let cancelled = false;
    (async () => {
      const user = await AuthService.getSessionUser();
      if (cancelled) return;
      if (!user) {
        router.replace('/login');
        return;
      }
      setCurrentUser(user);
    })();
    return () => { cancelled = true; };
  }, [router]);


  const handleLogout = async () => {
    await AuthService.logout();
    window.location.href = '/login';
  };

  // Congela transiciones/animaciones mientras se redimensiona la ventana, para que
  // las cards y zonas salten directo a su layout final en vez de animar el reflow
  // "poco a poco". La clase se retira 180ms después de la última señal (debounce).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      root.classList.add('is-resizing');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove('is-resizing'), 180);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
      root.classList.remove('is-resizing');
    };
  }, []);


  // 2. Pestaña Activa y Subpestañas (Sincronizadas con URL y localStorage)
  const {
    activeTab,
    setTab: setActiveTab,
    loanSubTab: loansSubTab,
    setLoanSubTab: setLoansSubTab
  } = useTabNavigation('overview');

  // 3. Mes y Año activo (Sincronizado en tiempo real con la fecha del sistema)
  const {
    currentYear,
    currentMonth,
    isMonthDropdownOpen,
    setIsMonthDropdownOpen,
    monthPickerRef,
    handlePrevMonth,
    handleNextMonth,
    handleGoToCurrentMonth,
    handleSelectMonth
  } = useMonthNavigation();

  // 4. Saldo Débito Inicial configurable por el usuario (Dinero con el que arranca)
  const [initialDebitBalances, setInitialDebitBalances] = useState<Record<string, number>>({});
  // Sueldo base real por mes (YYYY-MM). Se llena de una sola vez con el historial
  // de periodos; lo usan las vistas consolidadas y el simulador sin visitar el mes.
  const [monthlySalaries, setMonthlySalaries] = useState<Record<string, number>>({});

  // 5. Estados de Datos Interactivos
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [categories, setCategories] = useState(initialCategories);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'FIXED' | 'VARIABLE' | 'CARD_PAYMENTS' | 'INCOMES' | 'PAYABLES'>('ALL');
  const [dismissedAnomalyIds, setDismissedAnomalyIds] = useState<string[]>([]);

  const handleDismissAnomaly = (id: string) => {
    setDismissedAnomalyIds(prev => [...prev, id]);
  };

  const handleResetDismissedAnomalies = () => {
    setDismissedAnomalyIds([]);
  };

  // 6. Estados de Modales y Subpestañas
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isAdjustDebitModalOpen, setIsAdjustDebitModalOpen] = useState(false);

  // Estado para modal de confirmación segura de eliminación
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: 'transaction' | 'income' | 'receivable';
    description: string;
    amount: number;
    currency?: string;
    date?: string;
    categoryName?: string;
    paymentMethodName?: string;
    paymentMethodColor?: string;
    isFixed?: boolean;
    futureOccurrencesCount?: number;
  } | null>(null);

  // Estado para modal de confirmación segura de abono/cobranza de deudas o préstamos
  const [debtConfirmData, setDebtConfirmData] = useState<DebtConfirmData | null>(null);

  // Evitar cierre accidental de modales al seleccionar texto y soltar fuera
  const backdropMouseDownTarget = useRef<EventTarget | null>(null);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownTarget.current = e.target;
  };

  const handleBackdropClick = (closeFn: () => void) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownTarget.current === e.currentTarget) {
      closeFn();
    }
  };


  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardType, setEditCardType] = useState<'debit' | 'credit'>('credit');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardCloseDay, setEditCardCloseDay] = useState('20');
  const [editCardDueDay, setEditCardDueDay] = useState('15');
  const [editCardColor, setEditCardColor] = useState('#2563eb');
  const [editCardInitialDebt, setEditCardInitialDebt] = useState('');


  // El formulario de Ajustar Saldo Débito vive local en AdjustDebitModal (ver adjustDebit).

  // El formulario de Nueva Tarjeta vive local en CardModal (ver createCard).

  // Estados Fase 4: Analítica, Conciliación Bancaria y Sugerencias de IA
  // Por defecto 3 meses para no saturar la vista de Analítica con datos.
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6>(3);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  // Sub-pestaña activa del tab Tarjetas (compartida para que "Ver planificador" de
  // Visión General pueda saltar directo al Planificador de Pagos sin pasos extra).
  const [cardsSubTab, setCardsSubTab] = useState<'payments' | 'schedule'>('payments');

  const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  // `initialDebitForMonth` se deriva de la cadena de saldos (arrastre automático
  // del cierre del mes anterior). Se define más abajo, tras cargar hooks de datos.

  // Contexto temporal del mes visible (usado por hooks de datos y cálculos)
  const now = new Date();
  const isCurrentActiveMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);
  const isPastMonth = currentYear < now.getFullYear() || (currentYear === now.getFullYear() && currentMonth < (now.getMonth() + 1));
  const isFutureMonth = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > (now.getMonth() + 1));
  const currentDateStr = isCurrentActiveMonth
    ? `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    : isPastMonth
    ? getEndOfMonthDate(currentYear, currentMonth)
    : `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;


  // Transacciones: estado maestro, carga/sync del mes, formulario de gasto e IA
  const {
    transactions,
    setTransactions,
    editingTransactionId,
    setEditingTransactionId,
    isExpenseModalOpen,
    setIsExpenseModalOpen,
    desc,
    setDesc,
    amount,
    setAmount,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    isFetchingTc,
    tcInfo,
    setHasUserManuallyEditedTc,
    isSubmittingExpense,
    isScanningReceipt,
    scanReceiptError,
    isParsingNaturalExpense,
    naturalExpenseError,
    modalNaturalText,
    setModalNaturalText,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedMethodId,
    setSelectedMethodId,
    isRecurring,
    setIsRecurring,
    overrideDueDate,
    setOverrideDueDate,
    txDate,
    setTxDate,
    isRefundMode,
    setIsRefundMode,
    isInstallment,
    setIsInstallment,
    installmentsCount,
    setInstallmentsCount,
    hasInterest,
    setHasInterest,
    monthlyInstallmentAmount,
    setMonthlyInstallmentAmount,
    aiSuggestion,
    setAiSuggestion,
    currentMonthTransactions,
    modalDueDateDetail,
    modalCalculatedDueDate,
    fetchSunatRate,
    handleOpenCreateTransaction,
    handleOpenEditTransaction,
    handleScanReceiptFile,
    handleParseNaturalExpense,
    handleCreateTransaction,
    deleteTransactionById,
    deleteTransactionAndFuture
  } = useTransactions({
    monthKey,
    currentUser,
    currentYear,
    currentMonth,
    isCurrentActiveMonth,
    currentDateStr,
    paymentMethods,
    categories,
    reloadNonce
  });

  // Ingresos: sueldo base e ingresos extra del mes (con sus formularios y modales)
  const {
    salaries,
    setSalaries,
    extraIncomes,
    setExtraIncomes,
    currentOtherIncomes,
    totalSalaryAmount,
    isIncomeModalOpen,
    setIsIncomeModalOpen,
    isSalaryModalOpen,
    setIsSalaryModalOpen,
    salarySource,
    setSalarySource,
    salaryAmount,
    setSalaryAmount,
    salaryPayDay,
    setSalaryPayDay,
    addExtraIncome,
    creditLoanIncome,
    deleteExtraIncome,
    handleSaveSalary
  } = useIncomes({ monthKey, currentYear, currentMonth });

  // Abonos a tarjetas: historial, formulario/modal y listado del mes activo
  const {
    cardPayments,
    setCardPayments,
    currentMonthCardPayments,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    paymentSourceType,
    setPaymentSourceType,
    paymentCardId,
    setPaymentCardId,
    paymentAmount,
    setPaymentAmount,
    paymentCurrency,
    setPaymentCurrency,
    paymentExchangeRate,
    setPaymentExchangeRate,
    paymentTcInfo,
    hasUserManuallyEditedPaymentTc,
    setHasUserManuallyEditedPaymentTc,
    isFetchingPaymentTc,
    fetchPaymentSunatRate,
    paymentDate,
    setPaymentDate,
    editingCardPaymentId,
    editingCardPaymentIndex,
    showAllHistoricalPayments,
    setShowAllHistoricalPayments,
    handleOpenCreateCardPayment,
    handleOpenEditCardPayment,
    handleMakeCardPayment,
    handleClosePaymentModal,
    handleDeleteCardPayment
  } = useCardPayments({ paymentMethods, currentYear, currentMonth });

  // Cuentas por cobrar: préstamos que hice, agrupados por deudor, con cobros
  const {
    receivables,
    setReceivables,
    isReceivableModalOpen,
    setIsReceivableModalOpen,
    editingReceivableId,
    setEditingReceivableId,
    handleOpenEditReceivable,
    isCollectModalOpen,
    setIsCollectModalOpen,
    collectingRec,
    collectingDebtorGroup,
    collectAmountInput,
    setCollectAmountInput,
    collectPaymentDate,
    setCollectPaymentDate,
    collectPaymentNotes,
    setCollectPaymentNotes,
    expandedDebtors,
    setExpandedDebtors,
    receivablesFilter,
    setReceivablesFilter,
    debtorName,
    setDebtorName,
    loanDesc,
    setLoanDesc,
    loanAmount,
    setLoanAmount,
    loanCurrency,
    setLoanCurrency,
    loanExchangeRate,
    setLoanExchangeRate,
    loanDate,
    setLoanDate,
    loanIsDebitedFromAccount,
    setLoanIsDebitedFromAccount,
    loanPaymentMethodId,
    setLoanPaymentMethodId,
    isFetchingLoanTc,
    loanTcInfo,
    setHasUserManuallyEditedLoanTc,
    fetchLoanSunatRate,
    debtorGroups,
    filteredDebtorGroups,
    totalReceivablesRemaining,
    totalReceivablesRemainingUsd,
    handleOpenCollectModal,
    handleOpenGroupCollectModal,
    handleCascadeCollect,
    handleCollectReceivable,
    handleSaveCollect,
    handleOpenAddLoanForDebtor,
    toggleDebtorExpanded,
    handleCreateReceivable,
    deleteReceivable,
    isEditCollectModalOpen,
    setIsEditCollectModalOpen,
    editingCollectRecId,
    editingCollectPaymentId,
    editCollectPaymentDate,
    setEditCollectPaymentDate,
    editCollectPaymentNotes,
    setEditCollectPaymentNotes,
    editCollectAmount,
    setEditCollectAmount,
    editCollectDebtorName,
    handleOpenEditCollectPayment,
    handleSaveEditCollectPayment,
    handleDeleteCollectPayment
  } = useReceivables({
    currentYear,
    currentMonth,
    setDebtConfirmData,
    onDisburseLoan: (tx: Transaction) => {
      setTransactions(prev => [tx, ...prev]);
      SupabaseDataService.createTransaction(tx);
    },
    paymentMethods,
    categories
  });

  // Mis deudas: dinero que me prestaron, agrupado por acreedor, con pagos
  const {
    payables,
    setPayables,
    isPayableModalOpen,
    setIsPayableModalOpen,
    editingPayableId,
    setEditingPayableId,
    handleOpenEditPayable,
    isPayablePaymentModalOpen,
    setIsPayablePaymentModalOpen,
    payingPayable,
    payableCreditorName,
    setPayableCreditorName,
    payableDesc,
    setPayableDesc,
    payableAmount,
    setPayableAmount,
    payableDueDate,
    setPayableDueDate,
    payableIsCreditedToDebit,
    setPayableIsCreditedToDebit,
    payablePaymentAmount,
    setPayablePaymentAmount,
    payablePaymentDate,
    setPayablePaymentDate,
    payablePaymentNotes,
    setPayablePaymentNotes,
    payableCurrency,
    setPayableCurrency,
    payableExchangeRate,
    setPayableExchangeRate,
    payableIssueDate,
    setPayableIssueDate,
    isFetchingPayableTc,
    payableTcInfo,
    setHasUserManuallyEditedPayableTc,
    fetchPayableSunatRate,
    expandedCreditors,
    setExpandedCreditors,
    payablesFilter,
    setPayablesFilter,
    payingCreditorGroup,
    creditorGroups,
    filteredCreditorGroups,
    totalPayablesRemaining,
    totalPayablesRemainingUsd,
    handleOpenCreatePayable,
    handleCreatePayable,
    handleOpenAddLoanForCreditor,
    toggleCreditorExpanded,
    handleOpenGroupPayModal,
    handleCascadePay,
    handleOpenPayPayable,
    handlePayPayable,
    handleDeletePayable
  } = usePayables({ currentYear, currentMonth, onCreditToDebit: creditLoanIncome, setDebtConfirmData });

  // Navegación inteligente a acreedor / deudor con auto-filtro según estado de pago y auto-expansión
  const navigateToPayableCreditor = useCallback((creditorName: string) => {
    const trimmed = creditorName.trim().toLowerCase();
    const group = creditorGroups.find(
      g => g.creditorName?.trim().toLowerCase() === trimmed
    );
    if (group && group.isFullyPaid) {
      setPayablesFilter('paid');
    } else {
      setPayablesFilter('pending');
    }
    if (group) {
      setExpandedCreditors(prev => new Set([...prev, group.key]));
    }
    setActiveTab('receivables', 'payables');
  }, [creditorGroups, setPayablesFilter, setExpandedCreditors, setActiveTab]);

  const navigateToDebtor = useCallback((debtorNameStr: string) => {
    const trimmed = debtorNameStr.trim().toLowerCase();
    const group = debtorGroups.find(
      g => g.debtorName?.trim().toLowerCase() === trimmed
    );
    if (group && group.isFullyPaid) {
      setReceivablesFilter('paid');
    } else {
      setReceivablesFilter('pending');
    }
    if (group) {
      setExpandedDebtors(prev => new Set([...prev, group.key]));
    }
    setActiveTab('receivables', 'receivables');
  }, [debtorGroups, setReceivablesFilter, setExpandedDebtors, setActiveTab]);

  // Atajo PWA: si se entra con ?action=new-expense (acceso rápido del ícono en el
  // celular), abre directo el modal de registrar gasto. Solo una vez.
  const didPwaActionRef = useRef(false);
  useEffect(() => {
    if (didPwaActionRef.current || !currentUser || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new-expense') {
      didPwaActionRef.current = true;
      handleOpenCreateTransaction();
      const url = new URL(window.location.href);
      url.searchParams.delete('action');
      window.history.replaceState(null, '', url.toString());
    }
  }, [currentUser, handleOpenCreateTransaction]);

  // Coordinación de carga inicial unificada de datos de cuenta y fin del esqueleto
  // (se ejecuta una sola vez al autenticar, eliminando peticiones redundantes)
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (!currentUser || initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;

    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setIsInitialLoading(false);
    }, 6000);

    const pMethods = SupabaseDataService.getPaymentMethods().then(methods => {
      if (!isMounted) return;
      if (methods && methods.length > 0) {
        setPaymentMethods(prev => methods.map(m => {
          const known = prev.find(p => p.id === m.id);
          return { ...m, initialDebt: m.initialDebt ?? known?.initialDebt ?? 0 };
        }));
      } else if (methods && methods.length === 0) {
        initialPaymentMethods.forEach(pm => SupabaseDataService.createPaymentMethod(pm));
      }
    });

    const pRecs = SupabaseDataService.getReceivables().then(recs => {
      if (isMounted && recs && recs.length > 0) setReceivables(recs);
    });

    const pPays = SupabaseDataService.getPayables().then(pays => {
      if (isMounted && pays && pays.length > 0) setPayables(pays);
    });

    const pCats = SupabaseDataService.getCategories().then(cats => {
      if (isMounted && cats && cats.length > 0) setCategories(cats);
    });

    Promise.allSettled([pMethods, pRecs, pPays, pCats]).then(() => {
      if (isMounted) {
        clearTimeout(safetyTimer);
        setTimeout(() => {
          if (isMounted) setIsInitialLoading(false);
        }, 120);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [currentUser]);

  // Sincronización de datos por mes desde Supabase (las transacciones se cargan
  // en useTransactions; aquí quedan ingresos, periodo y abonos, que comparten
  // el mismo disparo de mes/usuario)
  useEffect(() => {
    if (!currentUser) return;

    // 2. Otros Ingresos
    SupabaseDataService.getOtherIncomes(monthKey).then(cloudIncomes => {
      if (cloudIncomes && cloudIncomes.length > 0) {
        setExtraIncomes(prev => ({
          ...prev,
          [monthKey]: cloudIncomes
        }));
      }
    });

    // 3. Saldo Débito Inicial y Sueldo
    SupabaseDataService.getMonthlyPeriod(currentYear, currentMonth).then(period => {
      if (period && period.initialDebitBalance !== undefined && period.initialDebitBalance > 0) {
        setInitialDebitBalances(prev => ({
          ...prev,
          [monthKey]: period.initialDebitBalance
        }));
      }
      if (period && period.baseSalary !== undefined && period.baseSalary > 0) {
        setSalaries(prev => [
          {
            id: prev[0]?.id || 'sal-1',
            source: prev[0]?.source || 'Empleo Principal',
            amount: period.baseSalary,
            payDay: prev[0]?.payDay || 30
          }
        ]);
      }
    });

    // 4. Abonos a Tarjetas (preservando tipo de origen Reembolso de Comercio / Abono de Banco)
    SupabaseDataService.getCardPayments(monthKey).then(cloudPayments => {
      if (cloudPayments && cloudPayments.length > 0) {
        setCardPayments(prev => {
          const localThisMonth = prev.filter(p => p.paymentDate.startsWith(monthKey));
          const enrichedCloud: CardPayment[] = cloudPayments.map((cp, idx) => {
            const localMatch = localThisMonth.find(lp =>
              (lp.id && cp.id && lp.id === cp.id) ||
              (lp.paymentMethodId === cp.paymentMethodId && Math.abs(lp.amountPaid - cp.amountPaid) < 0.01 && lp.paymentDate === cp.paymentDate)
            );
            return {
              id: cp.id || localMatch?.id || `cp-${monthKey}-${idx}`,
              paymentMethodId: cp.paymentMethodId,
              amountPaid: cp.amountPaid,
              paymentDate: cp.paymentDate,
              sourceType: cp.sourceType !== 'DEBIT_ACCOUNT' && cp.sourceType ? cp.sourceType : (localMatch?.sourceType || 'DEBIT_ACCOUNT')
            };
          });
          const localFiltered = prev.filter(p => !p.paymentDate.startsWith(monthKey));
          return [...localFiltered, ...enrichedCloud];
        });
      }
    });
  }, [monthKey, currentUser, currentYear, currentMonth, reloadNonce]);

  // Carga única del HISTORIAL COMPLETO (una vez por sesión autenticada). El resto
  // de la app trabaja mes a mes, pero las vistas consolidadas (Anual / Analítica)
  // necesitan todos los movimientos reales para derivar el flujo de cada mes en
  // lugar de datos fijos. Traemos transacciones, ingresos extra y abonos a tarjeta
  // de todo el historial y los fusionamos sin duplicar con lo ya cargado.
  const didLoadAllHistoryRef = useRef(false);
  useEffect(() => {
    if (!currentUser || didLoadAllHistoryRef.current) return;
    didLoadAllHistoryRef.current = true;

    SupabaseDataService.getAllTransactions().then(allTxs => {
      if (allTxs && allTxs.length > 0) {
        setTransactions(prev => deduplicateTransactions([...allTxs, ...prev]));
      }
    });

    SupabaseDataService.getAllOtherIncomes().then(grouped => {
      if (grouped) {
        setExtraIncomes(prev => {
          const merged = { ...prev };
          Object.entries(grouped).forEach(([k, list]) => {
            const byId = new Map((merged[k] || []).map(i => [i.id, i]));
            list.forEach(i => byId.set(i.id, i));
            merged[k] = Array.from(byId.values());
          });
          return merged;
        });
      }
    });

    SupabaseDataService.getAllCardPayments().then(allPayments => {
      if (allPayments && allPayments.length > 0) {
        setCardPayments(prev => {
          const keyOf = (p: CardPayment) => p.id || `${p.paymentMethodId}_${p.amountPaid}_${p.paymentDate}`;
          const byKey = new Map<string, CardPayment>();
          prev.forEach(p => byKey.set(keyOf(p), p));
          allPayments.forEach(cp => {
            const local = byKey.get(keyOf(cp));
            byKey.set(keyOf(cp), {
              id: cp.id || local?.id,
              paymentMethodId: cp.paymentMethodId,
              amountPaid: cp.amountPaid,
              paymentDate: cp.paymentDate,
              // Conservamos el origen especializado (Reembolso / Abono banco) si el
              // registro en la nube todavía lo trae como el genérico DEBIT_ACCOUNT.
              sourceType: (cp.sourceType && cp.sourceType !== 'DEBIT_ACCOUNT')
                ? cp.sourceType
                : (local?.sourceType || 'DEBIT_ACCOUNT')
            });
          });
          return Array.from(byKey.values());
        });
      }
    });

    // Periodos mensuales completos: saldo inicial y sueldo base de TODOS los meses.
    // Con esto las barras de ingreso de la evolución y el ancla de saldo inicial del
    // simulador reflejan cada mes sin necesidad de navegar hasta él. Las ediciones
    // locales del usuario (prev) prevalecen sobre lo recién traído.
    SupabaseDataService.getAllMonthlyPeriods().then(periods => {
      if (!periods) return;
      setInitialDebitBalances(prev => {
        const fromCloud: Record<string, number> = {};
        Object.entries(periods).forEach(([k, v]) => {
          if (v.initialDebitBalance > 0) fromCloud[k] = v.initialDebitBalance;
        });
        return { ...fromCloud, ...prev };
      });
      setMonthlySalaries(prev => {
        const fromCloud: Record<string, number> = {};
        Object.entries(periods).forEach(([k, v]) => {
          if (v.baseSalary > 0) fromCloud[k] = v.baseSalary;
        });
        return { ...fromCloud, ...prev };
      });
    });
  }, [currentUser, setTransactions, setExtraIncomes, setCardPayments, reloadNonce]);

  // Recarga de datos desde la nube (pull-to-refresh) SIN recargar la pagina:
  // actualiza todos los datos directamente en una sola ronda de peticiones sin duplicados.
  const reloadData = async () => {
    setIsRefreshingData(true);
    didLoadAllHistoryRef.current = false;

    try {
      await Promise.allSettled([
        SupabaseDataService.getPaymentMethods().then(methods => {
          if (methods && methods.length > 0) {
            setPaymentMethods(prev => methods.map(m => {
              const known = prev.find(p => p.id === m.id);
              return { ...m, initialDebt: m.initialDebt ?? known?.initialDebt ?? 0 };
            }));
          }
        }),
        SupabaseDataService.getReceivables().then(recs => {
          if (recs && recs.length > 0) setReceivables(recs);
        }),
        SupabaseDataService.getPayables().then(pays => {
          if (pays && pays.length > 0) setPayables(pays);
        }),
        SupabaseDataService.getCategories().then(cats => {
          if (cats && cats.length > 0) setCategories(cats);
        }),
        SupabaseDataService.getTransactions(monthKey).then(cloudTxs => {
          if (cloudTxs && cloudTxs.length > 0) {
            setTransactions(prev => deduplicateTransactions([...prev, ...cloudTxs]));
          }
        }),
        SupabaseDataService.getOtherIncomes(monthKey).then(cloudIncomes => {
          if (cloudIncomes && cloudIncomes.length > 0) {
            setExtraIncomes(prev => ({ ...prev, [monthKey]: cloudIncomes }));
          }
        }),
        SupabaseDataService.getMonthlyPeriod(currentYear, currentMonth).then(period => {
          if (period && period.initialDebitBalance !== undefined && period.initialDebitBalance > 0) {
            setInitialDebitBalances(prev => ({ ...prev, [monthKey]: period.initialDebitBalance }));
          }
          if (period && period.baseSalary !== undefined && period.baseSalary > 0) {
            setSalaries(prev => [
              {
                id: prev[0]?.id || 'sal-1',
                source: prev[0]?.source || 'Empleo Principal',
                amount: period.baseSalary,
                payDay: prev[0]?.payDay || 30
              }
            ]);
          }
        }),
        SupabaseDataService.getCardPayments(monthKey).then(cloudPayments => {
          if (cloudPayments && cloudPayments.length > 0) {
            setCardPayments(prev => {
              const localThisMonth = prev.filter(p => p.paymentDate.startsWith(monthKey));
              const enrichedCloud: CardPayment[] = cloudPayments.map((cp, idx) => {
                const localMatch = localThisMonth.find(lp =>
                  (lp.id && cp.id && lp.id === cp.id) ||
                  (lp.paymentMethodId === cp.paymentMethodId && Math.abs(lp.amountPaid - cp.amountPaid) < 0.01 && lp.paymentDate === cp.paymentDate)
                );
                return {
                  id: cp.id || localMatch?.id || `cp-${monthKey}-${idx}`,
                  paymentMethodId: cp.paymentMethodId,
                  amountPaid: cp.amountPaid,
                  paymentDate: cp.paymentDate,
                  sourceType: cp.sourceType !== 'DEBIT_ACCOUNT' && cp.sourceType ? cp.sourceType : (localMatch?.sourceType || 'DEBIT_ACCOUNT')
                };
              });
              const localFiltered = prev.filter(p => !p.paymentDate.startsWith(monthKey));
              return [...localFiltered, ...enrichedCloud];
            });
          }
        }),
        SupabaseDataService.getAllTransactions().then(allTxs => {
          if (allTxs && allTxs.length > 0) {
            setTransactions(prev => deduplicateTransactions([...allTxs, ...prev]));
          }
        }),
        SupabaseDataService.getAllOtherIncomes().then(grouped => {
          if (grouped) {
            setExtraIncomes(prev => {
              const merged = { ...prev };
              Object.entries(grouped).forEach(([k, list]) => {
                const byId = new Map((merged[k] || []).map(i => [i.id, i]));
                list.forEach(i => byId.set(i.id, i));
                merged[k] = Array.from(byId.values());
              });
              return merged;
            });
          }
        }),
        SupabaseDataService.getAllCardPayments().then(allPayments => {
          if (allPayments && allPayments.length > 0) {
            setCardPayments(prev => {
              const keyOf = (p: CardPayment) => p.id || `${p.paymentMethodId}_${p.amountPaid}_${p.paymentDate}`;
              const byKey = new Map<string, CardPayment>();
              prev.forEach(p => byKey.set(keyOf(p), p));
              allPayments.forEach(cp => {
                const local = byKey.get(keyOf(cp));
                byKey.set(keyOf(cp), {
                  id: cp.id || local?.id,
                  paymentMethodId: cp.paymentMethodId,
                  amountPaid: cp.amountPaid,
                  paymentDate: cp.paymentDate,
                  sourceType: (cp.sourceType && cp.sourceType !== 'DEBIT_ACCOUNT') ? cp.sourceType : (local?.sourceType || 'DEBIT_ACCOUNT')
                });
              });
              return Array.from(byKey.values());
            });
          }
        }),
        SupabaseDataService.getAllMonthlyPeriods().then(periods => {
          if (!periods) return;
          setInitialDebitBalances(prev => {
            const fromCloud: Record<string, number> = {};
            Object.entries(periods).forEach(([k, v]) => {
              if (v.initialDebitBalance > 0) fromCloud[k] = v.initialDebitBalance;
            });
            return { ...fromCloud, ...prev };
          });
          setMonthlySalaries(prev => {
            const fromCloud: Record<string, number> = {};
            Object.entries(periods).forEach(([k, v]) => {
              if (v.baseSalary > 0) fromCloud[k] = v.baseSalary;
            });
            return { ...fromCloud, ...prev };
          });
        })
      ]);
    } finally {
      setIsRefreshingData(false);
    }
  };

  // ==============================================================================
  // CADENA DE SALDOS DE DÉBITO (ARRASTRE AUTOMÁTICO MES A MES)
  // El saldo inicial de cada mes se arrastra del cierre proyectado del mes anterior.
  // `initialDebitBalances` guarda SOLO overrides explícitos del usuario, que anclan
  // ese mes y cortan el recálculo hacia atrás. El resto se deriva.
  // ==============================================================================
  const primaryPayDay = salaries[0]?.payDay ?? 30;
  const debitChain = useMemo(() => computeMonthlyDebitChain({
    overrides: initialDebitBalances,
    transactions,
    extraIncomes,
    cardPayments,
    receivables,
    payables,
    paymentMethods,
    monthlySalaries,
    currentSalaryTotal: totalSalaryAmount,
    primaryPayDay,
    extraKeys: [monthKey]
  }), [initialDebitBalances, transactions, extraIncomes, cardPayments, receivables, payables, paymentMethods, monthlySalaries, totalSalaryAmount, primaryPayDay, monthKey]);

  // Saldo inicial efectivo del mes visible: override explícito → arrastre → 0.
  const initialDebitForMonth = (monthKey in initialDebitBalances)
    ? initialDebitBalances[monthKey]
    : (debitChain[monthKey]?.initial ?? 0);
  // ¿El saldo inicial es automático (arrastrado) y no un override manual?
  const isInitialDebitAuto = !(monthKey in initialDebitBalances) && debitChain[monthKey] != null;

  // Cobranzas atribuidas al mes visible (para no duplicar cobros ya arrastrados en
  // el saldo inicial: cada cobro se cuenta una vez, en su mes de atribución).
  const monthReceivables = useMemo(
    () => receivables.filter(r => getReceivableCollectionMonth(r) === monthKey),
    [receivables, monthKey]
  );

  const budget = useMemo(() => ({
    year: currentYear,
    month: currentMonth,
    baseSalary: totalSalaryAmount,
    salaries,
    initialDebitBalance: initialDebitForMonth,
    otherIncomes: currentOtherIncomes
  }), [currentYear, currentMonth, totalSalaryAmount, salaries, initialDebitForMonth, currentOtherIncomes]);

  // Conciliación bancaria (estado del estado de cuenta e importación de faltantes)
  const {
    isParsingStatement,
    reconciliationSummary,
    setReconciliationSummary,
    reconciliationFilter,
    setReconciliationFilter,
    statementFileName,
    setStatementFileName,
    handleStatementFileUpload,
    handleImportStatementItem,
    handleImportAllUnmatched
  } = useReconciliation({
    monthKey,
    categories,
    paymentMethods,
    allTransactions: transactions,
    setTransactions
  });

  // ==============================================================================
  // CÁLCULOS ESPECÍFICOS DE SALDO DÉBITO (FÓRMULA P9 DEL EXCEL REPLICADA AL 100%)
  // ==============================================================================
  const debitStats = useMemo(() => {
    const debitMethodIds = paymentMethods.filter(p => p.type === 'debit' || p.type === 'cash').map(p => p.id);
    const cardPaymentsThisMonthTotal = cardPayments
      .filter(p => p.paymentDate.startsWith(monthKey) && p.sourceType !== 'MERCHANT_REFUND' && p.sourceType !== 'BANK_CREDIT')
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const base = calculateCurrentDebitBalance(
      initialDebitForMonth,
      salaries,
      currentOtherIncomes,
      monthReceivables,
      currentMonthTransactions,
      debitMethodIds,
      cardPaymentsThisMonthTotal,
      currentDateStr,
      payables
    );

    // Deudas propias que vencen en el mes visible y aún no se pagan: se restan del
    // saldo PROYECTADO a fin de mes (es un compromiso que saldrás), no del saldo de
    // hoy (ese dinero sigue en cuenta hasta que efectivamente pagues). Se usa el
    // saldo pendiente, así lo ya abonado no se descuenta dos veces.
    const scheduledDebtDueThisMonth = payables
      .filter(p => {
        if (p.status === 'PAID') return false;
        const due = (p.dueDate || '');
        if (due.startsWith(monthKey)) return true;
        if (!isPastMonth && due.length >= 7 && due < monthKey && isCurrentActiveMonth) return true;
        return false;
      })
      .reduce((acc, p) => {
        const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
        const pen = p.currency === 'USD' ? rem * (p.exchangeRate || FALLBACK_USD_PEN_RATE) : rem;
        return acc + Math.max(0, pen);
      }, 0);

    // Cuotas/estados de cuenta de TARJETA que vencen ESTE mes (por fecha de vencimiento
    // bancaria), netos de reembolsos y de lo ya abonado en el mes: es caja que debe
    // salir del débito para no generar intereses. Solo cuenta en meses en curso o
    // futuros: en un mes ya cerrado el saldo real refleja lo que efectivamente se pagó.
    const creditCardIds = paymentMethods.filter(p => p.type === 'credit').map(p => p.id);
    const cardBillsDueThisMonth = transactions
      .filter(t => creditCardIds.includes(t.paymentMethodId) && (t.paymentDueDate || '').startsWith(monthKey))
      .reduce((acc, t) => acc + (t.isRefund ? -Math.abs(t.amountPen) : t.amountPen), 0);
    const unpaidCardBillsDueThisMonth = isPastMonth
      ? 0
      : Math.max(0, cardBillsDueThisMonth - cardPaymentsThisMonthTotal);

    // El saldo PROYECTADO a fin de mes se toma del CIERRE de la cadena de arrastre
    // (misma fuente que alimenta el "saldo base" del mes siguiente), para que lo que
    // ve el usuario sea EXACTAMENTE lo que se arrastra: proyección y arrastre cuadran
    // entre meses. La cadena ya resta los compromisos (deudas programadas + cuotas de
    // tarjeta por vencer) de los meses en curso/futuros. Fallback al cálculo directo si
    // el mes aún no está en la cadena.
    const chainClosing = debitChain[monthKey]?.closing;
    const projectedDebitBalanceMonthEnd = chainClosing != null
      ? chainClosing
      : Math.round((base.projectedDebitBalanceMonthEnd - scheduledDebtDueThisMonth - unpaidCardBillsDueThisMonth) * 100) / 100;

    return {
      ...base,
      projectedDebitBalanceMonthEnd,
      scheduledDebtDueThisMonth: Math.round(scheduledDebtDueThisMonth * 100) / 100,
      cardBillsDueThisMonth: Math.round(Math.max(0, cardBillsDueThisMonth) * 100) / 100,
      unpaidCardBillsDueThisMonth: Math.round(unpaidCardBillsDueThisMonth * 100) / 100
    };
  }, [initialDebitForMonth, salaries, currentOtherIncomes, monthReceivables, currentMonthTransactions, transactions, paymentMethods, cardPayments, monthKey, currentDateStr, payables, isPastMonth, debitChain]);

  // Saldo de cierre del mes anterior, tomado de la cadena de saldos (mismo cálculo
  // que alimenta el arrastre automático). Sirve al modal "Ajustar Saldo" como
  // referencia cuando el usuario quiere fijar un override manual. Ya viene redondeado.
  const prevMonthClosingBalance = useMemo(() => {
    let pYear = currentYear;
    let pMonth = currentMonth - 1;
    if (pMonth < 1) {
      pMonth = 12;
      pYear -= 1;
    }
    const pKey = `${pYear}-${pMonth.toString().padStart(2, '0')}`;
    const link = debitChain[pKey];
    if (!link) return null;
    return {
      monthKey: pKey,
      monthName: MONTH_NAMES[pMonth],
      amount: link.closing
    };
  }, [currentYear, currentMonth, debitChain]);

  // Comparativa real dinámica de gasto entre el mes actual y el mes anterior para el panel del Dashboard
  const monthlyComparison = useMemo(() => {
    let pYear = currentYear;
    let pMonth = currentMonth - 1;
    if (pMonth < 1) {
      pMonth = 12;
      pYear -= 1;
    }
    const pKey = `${pYear}-${pMonth.toString().padStart(2, '0')}`;

    const prevTxs = transactions.filter(t => t.date.startsWith(pKey));
    const prevExpense = prevTxs.reduce((sum, t) => sum + (t.amountPen || 0), 0);
    const currExpense = currentMonthTransactions.reduce((sum, t) => sum + (t.amountPen || 0), 0);

    const maxExp = Math.max(prevExpense, currExpense, 1);
    const prevPercent = prevExpense > 0 ? (prevExpense / maxExp) * 100 : 0;
    const currPercent = currExpense > 0 ? (currExpense / maxExp) * 100 : 0;

    let variationPct = 0;
    let variationStr = '0.0%';
    let isReduction = true;

    if (prevExpense === 0) {
      if (currExpense > 0) {
        variationStr = '+100%';
        isReduction = false;
      } else {
        variationStr = '0.0%';
        isReduction = true;
      }
    } else {
      const diff = currExpense - prevExpense;
      variationPct = (diff / prevExpense) * 100;
      variationStr = `${variationPct > 0 ? '+' : ''}${variationPct.toFixed(1)}%`;
      isReduction = variationPct <= 0;
    }

    const differential = Math.abs(currExpense - prevExpense);

    return {
      prevMonthLabel: `${MONTH_NAMES[pMonth]} ${pYear}`,
      prevExpense,
      prevPercent,
      currMonthLabel: `${MONTH_NAMES[currentMonth]} ${currentYear}`,
      currExpense,
      currPercent,
      variationStr,
      isReduction,
      differential
    };
  }, [currentYear, currentMonth, currentMonthTransactions, transactions]);

  // Diagnóstico financiero mensual
  const diagnostic = useMemo(() => {
    return calculateMonthlyDiagnostic(
      budget,
      currentMonthTransactions,
      monthReceivables,
      transactions,
      payables,
      cardPayments,
      paymentMethods,
      isPastMonth
    );
  }, [budget, currentMonthTransactions, monthReceivables, transactions, payables, cardPayments, paymentMethods, isPastMonth]);

  // Resumen de deuda por tarjeta
  const cardDebtSummary = useMemo(() => {
    return calculateCardsDebtSummary(
      paymentMethods,
      currentMonthTransactions,
      transactions,
      cardPayments,
      currentYear,
      currentMonth
    );
  }, [paymentMethods, currentMonthTransactions, transactions, cardPayments, currentYear, currentMonth]);

  // Asesor de tarjeta: qué tarjeta conviene usar HOY para maximizar días sin
  // intereses, penalizando las de utilización alta (cuida el historial crediticio).
  // Usa la fecha real de hoy (la recomendación es para hoy, no para el mes visible).
  const cardAdvisor = useMemo(() => {
    const utilizationByCard: Record<string, number> = {};
    cardDebtSummary.forEach(c => {
      const pm = paymentMethods.find(p => p.id === c.paymentMethodId);
      const limit = pm?.creditLimit || 0;
      utilizationByCard[c.paymentMethodId] = limit > 0 && !c.hasPositiveBalance
        ? Math.min(100, (c.totalAccumulatedDebt / limit) * 100)
        : 0;
    });
    return getBestCardRecommendation(paymentMethods, new Date(), utilizationByCard);
  }, [paymentMethods, cardDebtSummary]);

  // Plan de pagos de tarjeta FORWARD-LOOKING (independiente del mes visible): para
  // cada tarjeta calcula su PRÓXIMO pago real —fecha de vencimiento ya ajustada a
  // día hábil (viene en t.paymentDueDate) y monto de ese estado de cuenta—, más la
  // utilización total. Agrupa por mes de vencimiento y asigna los abonos en FIFO
  // (paga lo más antiguo primero). Así el usuario ve "cuándo y cuánto pagar" sin
  // navegar entre meses.
  const cardPaymentPlan = useMemo(() => {
    const nowRef = new Date();
    const todayStr = `${nowRef.getFullYear()}-${(nowRef.getMonth() + 1).toString().padStart(2, '0')}-${nowRef.getDate().toString().padStart(2, '0')}`;
    const creditCards = paymentMethods.filter(p => p.type === 'credit' && p.isActive);

    return creditCards.map(card => {
      const cardTxs = transactions.filter(t => {
        const resolved = resolvePaymentMethod(t, paymentMethods);
        return resolved?.id === card.id || t.paymentMethodId === card.id;
      });

      // Monto facturado por mes de vencimiento + fecha de vencimiento representativa.
      const dueByMonth = new Map<string, number>();
      const dateByMonth = new Map<string, string>();
      cardTxs.forEach(t => {
        const net = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
        const dd = t.paymentDueDate || t.date || '';
        const mk = dd.slice(0, 7);
        if (!mk) return;
        dueByMonth.set(mk, (dueByMonth.get(mk) || 0) + net);
        const prev = dateByMonth.get(mk);
        if (!prev || dd > prev) dateByMonth.set(mk, dd);
      });

      const totalPaid = cardPayments
        .filter(p => p.paymentMethodId === card.id && p.sourceType !== 'MERCHANT_REFUND' && p.sourceType !== 'BANK_CREDIT')
        .reduce((acc, p) => acc + p.amountPaid, 0);

      // Cubetas ordenadas: deuda arrastrada (initialDebt) primero, luego por mes.
      const initial = card.initialDebt || 0;
      const buckets: { key: string; dueDate: string; unpaid: number }[] = [];
      if (initial > 0) buckets.push({ key: 'initial', dueDate: todayStr, unpaid: initial });
      Array.from(dueByMonth.keys()).sort().forEach(mk => {
        const billed = Math.max(0, dueByMonth.get(mk) || 0);
        if (billed > 0.005) buckets.push({ key: mk, dueDate: dateByMonth.get(mk) || `${mk}-15`, unpaid: billed });
      });

      // FIFO: los abonos cancelan primero lo más antiguo.
      let remaining = totalPaid;
      for (const b of buckets) {
        const applied = Math.min(b.unpaid, remaining);
        b.unpaid -= applied;
        remaining -= applied;
        if (remaining <= 0) break;
      }

      const totalUnpaid = buckets.reduce((acc, b) => acc + b.unpaid, 0);
      const next = buckets.find(b => b.unpaid > 0.005) || null;
      const limit = card.creditLimit || 0;

      // Próxima fecha de CORTE (distinta al vencimiento). El buró reporta tu saldo el
      // día del corte, así que bajar el saldo antes de esa fecha mejora tu utilización
      // reportada. Si hoy ya pasó el día de corte, el próximo corte es el mes siguiente.
      const closeDay = card.billingCloseDay || 0;
      let nextCloseDate: string | null = null;
      let scorePayByDate: string | null = null;
      if (closeDay > 0) {
        let cy = nowRef.getFullYear();
        let cm = nowRef.getMonth(); // 0-indexado
        if (nowRef.getDate() > closeDay) {
          cm += 1;
          if (cm > 11) { cm = 0; cy += 1; }
        }
        const clampedDay = Math.min(closeDay, new Date(cy, cm + 1, 0).getDate());
        nextCloseDate = `${cy}-${(cm + 1).toString().padStart(2, '0')}-${clampedDay.toString().padStart(2, '0')}`;
        // Sugerencia: abonar ~2 días antes del corte para que el pago alcance a procesar.
        const sd = new Date(cy, cm, clampedDay, 12, 0, 0);
        sd.setDate(sd.getDate() - 2);
        scorePayByDate = `${sd.getFullYear()}-${(sd.getMonth() + 1).toString().padStart(2, '0')}-${sd.getDate().toString().padStart(2, '0')}`;
      }

      return {
        cardId: card.id,
        cardName: card.name,
        cardColor: card.color,
        billingCloseDay: card.billingCloseDay || 0,
        paymentDueDay: card.paymentDueDay || 0,
        limit,
        totalUnpaid: Math.round(totalUnpaid * 100) / 100,
        utilizationPct: limit > 0 ? Math.min(100, (totalUnpaid / limit) * 100) : 0,
        nextDueDate: next ? next.dueDate : null,
        nextDueAmount: next ? Math.round(next.unpaid * 100) / 100 : 0,
        isOverdue: next ? next.dueDate < todayStr : false,
        nextCloseDate,
        scorePayByDate
      };
    });
  }, [paymentMethods, transactions, cardPayments]);

  // Agrupación y Consolidación de Cuentas por Cobrar por Persona (Ficha de Deudor)
  // Agrupación y Consolidación de Mis Deudas por Acreedor (Ficha de Acreedor)
  // Pagos a Tarjetas Realizados en el Mes Activo (Comprobantes de Salida Bancaria)
  // Desglose de Gastos por Categoría
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: typeof initialCategories[0]; total: number }>();
    currentMonthTransactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId) || categories[11];
      const existing = map.get(cat.id) || { category: cat, total: 0 };
      const net = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
      existing.total += net;
      map.set(cat.id, existing);
    });

    const items = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const totalSpent = diagnostic.totalExpensesConsumed || 1;

    return items.map(item => ({
      ...item,
      percentage: (item.total / totalSpent) * 100
    }));
  }, [currentMonthTransactions, categories, diagnostic.totalExpensesConsumed]);

  // Desglose de Gastos por Categoría del AÑO completo (para la donut de la vista
  // Anual). Agrega todo el historial cargado del año visible, neto de reembolsos.
  const annualCategoryBreakdown = useMemo(() => {
    const yearPrefix = `${currentYear}-`;
    const map = new Map<string, { category: typeof initialCategories[0]; total: number }>();
    transactions.forEach(t => {
      if (!(t.date || '').startsWith(yearPrefix)) return;
      const cat = categories.find(c => c.id === t.categoryId) || categories[11];
      const existing = map.get(cat.id) || { category: cat, total: 0 };
      const net = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
      existing.total += net;
      map.set(cat.id, existing);
    });

    const items = Array.from(map.values()).filter(i => i.total > 0).sort((a, b) => b.total - a.total);
    const totalSpent = items.reduce((acc, i) => acc + i.total, 0) || 1;

    return items.map(item => ({
      ...item,
      percentage: (item.total / totalSpent) * 100
    }));
  }, [transactions, categories, currentYear]);

  // Total de Gastos Fijos del mes
  const fixedExpensesTotal = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.isFixedSubscription)
      .reduce((acc, curr) => acc + curr.amountPen, 0);
  }, [currentMonthTransactions]);

  // Pronóstico de Flujo de Caja a 3 o 6 Meses (Cashflow Forecasting IA)
  const forecastData = useMemo(() => {
    const fixedList = transactions.filter(t => t.isFixedSubscription && t.date.startsWith(monthKey));
    const variableTxs = currentMonthTransactions.filter(t => !t.isFixedSubscription);
    const variableSum = variableTxs.reduce((acc, curr) => acc + (curr.isRefund ? -Math.abs(curr.amountPen) : curr.amountPen), 0);
    const creditCardIds = paymentMethods.filter(p => p.type === 'credit').map(p => p.id);

    // Calcular promedio histórico real de gastos variables mensuales en base al historial
    const variableByMonth = new Map<string, number>();
    transactions.forEach(t => {
      if (!t.isFixedSubscription && t.date) {
        const ym = t.date.slice(0, 7);
        const net = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
        variableByMonth.set(ym, (variableByMonth.get(ym) || 0) + net);
      }
    });
    const pastMonthsVars = Array.from(variableByMonth.values()).filter(v => v > 0);
    const historicalMonthlyVariableAvg = pastMonthsVars.length > 0
      ? Math.round(pastMonthsVars.reduce((acc, v) => acc + v, 0) / pastMonthsVars.length * 100) / 100
      : (variableSum > 0 ? variableSum : 750);

    return AIIntelligenceService.generateCashflowForecast(
      currentYear,
      currentMonth,
      debitStats.projectedDebitBalanceMonthEnd,
      salaries,
      fixedList,
      historicalMonthlyVariableAvg,
      forecastHorizon,
      transactions,
      creditCardIds,
      extraIncomes,
      initialDebitBalances,
      payables,
      receivables
    );
  }, [currentYear, currentMonth, debitStats.projectedDebitBalanceMonthEnd, salaries, transactions, currentMonthTransactions, monthKey, forecastHorizon, paymentMethods, extraIncomes, initialDebitBalances, payables, receivables]);

  // Detección Inteligente de Anomalías y Cobros Duplicados (IA & NLP).
  // Cargos duplicados y picos se evalúan sobre el mes visible; las suscripciones
  // recurrentes necesitan ver varios meses, así que pasamos el historial completo.
  const aiAnomalies = useMemo(() => {
    const detected = AIIntelligenceService.detectAnomalies(currentMonthTransactions, categories, transactions);
    return detected.filter(a => !dismissedAnomalyIds.includes(a.id));
  }, [currentMonthTransactions, categories, transactions, dismissedAnomalyIds]);

  // Evolución Histórica Multimes (para gráfico de barras y analítica dinámica).
  // Se deriva por completo de datos reales: la salida de caja de cada mes es la
  // suma de las transacciones cuyo vencimiento cae en ese mes (neta de reembolsos),
  // es decir diagnostic.realCashOutflow generalizado a todo el historial cargado.
  // El ingreso combina el sueldo recurrente con los ingresos extra reales del mes.
  const monthlyHistoricalFlow = useMemo(() => {
    const currentSalary = salaries.reduce((acc, s) => acc + s.amount, 0);

    // "Hoy" real: los meses posteriores al mes en curso se marcan como proyectados.
    const nowRef = new Date();
    const realCurrentKey = `${nowRef.getFullYear()}-${(nowRef.getMonth() + 1).toString().padStart(2, '0')}`;
    const yearPrefix = `${currentYear}-`;

    // Dos agregados netos por mes del año visible (ambos descuentan reembolsos):
    //  - outByMonth: salida real de caja (por fecha de vencimiento del pago).
    //  - consumedByMonth: gasto devengado (por fecha en que se realizó el gasto).
    const outByMonth = new Map<string, number>();
    const consumedByMonth = new Map<string, number>();
    const candidateMonths = new Set<string>();
    transactions.forEach(t => {
      const net = t.isRefund ? -Math.abs(t.amountPen) : t.amountPen;
      const dueKey = (t.paymentDueDate || t.date || '').slice(0, 7);
      if (dueKey.startsWith(yearPrefix)) {
        outByMonth.set(dueKey, (outByMonth.get(dueKey) || 0) + net);
        candidateMonths.add(dueKey);
      }
      const dateKey = (t.date || '').slice(0, 7);
      if (dateKey.startsWith(yearPrefix)) {
        consumedByMonth.set(dateKey, (consumedByMonth.get(dateKey) || 0) + net);
        candidateMonths.add(dateKey);
      }
    });

    // Salidas por deudas propias a acreedores (pagos efectuados + deudas programadas no pagadas en meses actuales/futuros)
    payables.forEach(p => {
      const isUsd = p.currency === 'USD';
      const exRate = p.exchangeRate || FALLBACK_USD_PEN_RATE;
      (p.payments || []).forEach(pay => {
        const payKey = (pay.paymentDate || '').slice(0, 7);
        if (payKey.startsWith(yearPrefix)) {
          const pen = isUsd ? (pay.amountPaid || pay.amount || 0) * exRate : (pay.amountPaid || pay.amount || 0);
          outByMonth.set(payKey, (outByMonth.get(payKey) || 0) + pen);
          consumedByMonth.set(payKey, (consumedByMonth.get(payKey) || 0) + pen);
          candidateMonths.add(payKey);
        }
      });
      if (p.status !== 'PAID') {
        const dueKey = (p.dueDate || '').slice(0, 7);
        if (dueKey.startsWith(yearPrefix) && dueKey >= realCurrentKey) {
          const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
          const pen = isUsd ? rem * exRate : rem;
          outByMonth.set(dueKey, (outByMonth.get(dueKey) || 0) + pen);
          candidateMonths.add(dueKey);
        }
      }
    });

    // Meses candidatos del año: los que tienen actividad real (gastos vencidos,
    // gastos registrados o ingresos extra), más el mes en curso y el visible.
    Object.keys(extraIncomes).forEach(k => { if (k.startsWith(yearPrefix)) candidateMonths.add(k); });
    if (monthKey.startsWith(yearPrefix)) candidateMonths.add(monthKey);
    if (realCurrentKey.startsWith(yearPrefix)) candidateMonths.add(realCurrentKey);

    // Sin datos del año todavía: no inventamos meses.
    if (candidateMonths.size === 0) return [];

    // Rango contiguo desde el primer al último mes con actividad (sin huecos).
    const monthNums = Array.from(candidateMonths).map(k => parseInt(k.split('-')[1], 10));
    const firstMonth = Math.min(...monthNums);
    const lastMonth = Math.max(...monthNums);

    const items = [];
    for (let m = firstMonth; m <= lastMonth; m++) {
      const key = `${currentYear}-${m.toString().padStart(2, '0')}`;
      const extraTotal = (extraIncomes[key] || []).reduce((acc, curr) => acc + curr.amount, 0);
      // Sueldo real del mes (si se guardó uno propio); si no, el sueldo global vigente.
      const monthSalary = monthlySalaries[key] || currentSalary;
      const inVal = Number((monthSalary + extraTotal).toFixed(2));
      const outVal = Number((outByMonth.get(key) || 0).toFixed(2));
      const consumed = Number((consumedByMonth.get(key) || 0).toFixed(2));
      const savings = Number((inVal - outVal).toFixed(2));

      items.push({
        key,
        label: `${MONTH_NAMES[m].slice(0, 3)} ${currentYear}`,
        inVal,
        outVal,
        consumed,
        savings,
        isProjected: key > realCurrentKey
      });
    }
    return items;
  }, [salaries, monthlySalaries, extraIncomes, transactions, payables, monthKey, currentYear]);

  // Score de Salud Financiera DETERMINISTA (0-100). Se calcula en código para ser
  // reproducible; la IA solo lo explica/prioriza después. Reutiliza el diagnóstico
  // de liquidez, la deuda de tarjetas y la evolución histórica ya derivados.
  const financialHealth = useMemo(() => {
    const currentFlow = monthlyHistoricalFlow.find(m => m.key === monthKey);
    const totalIncome = currentFlow?.inVal || (diagnostic.totalAvailable - initialDebitForMonth - debitStats.collectedFromDebtors) || totalSalaryAmount;
    const cardObligations = cardDebtSummary.reduce((acc, c) => acc + (c.consumedToDate || 0) + (c.initialDebt || 0), 0);
    const cardPaid = cardDebtSummary.reduce((acc, c) => acc + (c.paidToDate || 0), 0);
    return computeFinancialHealthScore({
      totalIncome,
      liquidityMargin: diagnostic.liquidityMargin,
      savingsRatePercentage: diagnostic.savingsRatePercentage,
      cardObligations,
      cardPaid,
      historicalFlow: monthlyHistoricalFlow,
      currentMonthKey: monthKey
    });
  }, [monthlyHistoricalFlow, monthKey, diagnostic, cardDebtSummary, initialDebitForMonth, debitStats.collectedFromDebtors, totalSalaryAmount]);

  // Filtro de transacciones (Búsqueda + Categoría + Tarjeta/Medio + Tipo Fijo/Variable)
  const filteredTransactions = useMemo(() => {
    return currentMonthTransactions.filter(t => {
      const matchSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === 'ALL' || t.categoryId === selectedCategory;
      const matchType =
        txTypeFilter === 'ALL' ||
        (txTypeFilter === 'FIXED' ? !!t.isFixedSubscription : !t.isFixedSubscription);
      let matchMethod = selectedPaymentMethod === 'ALL';
      if (!matchMethod) {
        const resolved = resolvePaymentMethod(t, paymentMethods);
        matchMethod = resolved?.id === selectedPaymentMethod || t.paymentMethodId === selectedPaymentMethod;
      }
      return matchSearch && matchCat && matchType && matchMethod;
    });
  }, [currentMonthTransactions, searchQuery, selectedCategory, txTypeFilter, selectedPaymentMethod, paymentMethods]);

  // Movimientos unificados para la tabla y feed táctil (Gastos, Pagos Tarjeta, Ingresos, Pagos de Deudas y Cobros de Préstamos)
  type UnifiedMovement =
    | { kind: 'transaction'; data: Transaction; sortDate: string }
    | { kind: 'card_payment'; data: CardPayment; index: number; sortDate: string }
    | { kind: 'income'; data: { id: string; description: string; amount: number; date: string; type: 'salary' | 'extra' | 'borrowed'; createdAt?: string }; sortDate: string }
    | { kind: 'payable_payment'; data: { id: string; payableId: string; creditorName: string; description: string; amount: number; currency?: 'PEN' | 'USD'; exchangeRate?: number; paymentDate: string; notes?: string; createdAt?: string }; sortDate: string }
    | { kind: 'receivable_payment'; data: { id: string; receivableId: string; debtorName: string; description: string; amount: number; currency?: 'PEN' | 'USD'; exchangeRate?: number; paymentDate: string; notes?: string; createdAt?: string }; sortDate: string }
    | { kind: 'scheduled_payable'; data: { id: string; payableId: string; creditorName: string; description: string; amountPen: number; currency?: 'PEN' | 'USD'; remaining: number; dueDate: string }; sortDate: string };

  const combinedMovements = useMemo<UnifiedMovement[]>(() => {
    const items: UnifiedMovement[] = [];

    // 1. Gastos (si no se filtró exclusivamente por pagos de tarjeta, ingresos o deudas)
    if (txTypeFilter === 'ALL' || txTypeFilter === 'FIXED' || txTypeFilter === 'VARIABLE') {
      filteredTransactions.forEach(t => {
        items.push({ kind: 'transaction', data: t, sortDate: t.date });
      });
    }

    // 2. Pagos a tarjeta (incluidos cuando es ALL o CARD_PAYMENTS)
    if (txTypeFilter === 'ALL' || txTypeFilter === 'CARD_PAYMENTS') {
      currentMonthCardPayments.forEach((pay, idx) => {
        const pm = resolvePaymentMethod({ paymentMethodId: pay.paymentMethodId }, paymentMethods) || paymentMethods.find(p => p.id === pay.paymentMethodId);
        const searchMatches = !searchQuery ||
          `pago tarjeta ${pm?.name || ''} amortización débito abono`.toLowerCase().includes(searchQuery.toLowerCase());
        const catMatches = selectedCategory === 'ALL';
        const methodMatches = selectedPaymentMethod === 'ALL' || pay.paymentMethodId === selectedPaymentMethod || pm?.id === selectedPaymentMethod;
        if (searchMatches && catMatches && methodMatches) {
          items.push({ kind: 'card_payment', data: pay, index: idx, sortDate: pay.paymentDate });
        }
      });
    }

    // 3. Ingresos del mes (Sueldos e Ingresos Extras)
    if (txTypeFilter === 'ALL' || txTypeFilter === 'INCOMES') {
      const [y, m] = monthKey.split('-').map(Number);
      salaries.forEach(sal => {
        const effectivePayDay = getEffectiveDayOfMonth(y, m, sal.payDay);
        const salDate = `${monthKey}-${effectivePayDay.toString().padStart(2, '0')}`;
        const searchMatches = !searchQuery || `sueldo ${sal.source}`.toLowerCase().includes(searchQuery.toLowerCase());
        if (searchMatches && selectedCategory === 'ALL' && selectedPaymentMethod === 'ALL') {
          items.push({
            kind: 'income',
            data: {
              id: `sal-${sal.id}-${monthKey}`,
              description: `Sueldo: ${sal.source}`,
              amount: sal.amount,
              date: salDate,
              type: 'salary'
            },
            sortDate: salDate
          });
        }
      });

      currentOtherIncomes.forEach(oi => {
        if (oi.id && oi.id.startsWith('inc-loan-')) return;
        const searchMatches = !searchQuery || `ingreso extra ${oi.description}`.toLowerCase().includes(searchQuery.toLowerCase());
        if (searchMatches && selectedCategory === 'ALL' && selectedPaymentMethod === 'ALL') {
          items.push({
            kind: 'income',
            data: {
              id: oi.id,
              description: `Ingreso Extra: ${oi.description}`,
              amount: oi.amount,
              date: oi.receivedDate,
              type: 'extra'
            },
            sortDate: oi.receivedDate
          });
        }
      });
    }

    // 3.b Préstamos recibidos acreditados a cuenta débito (Ingreso de dinero en cuenta)
    if (txTypeFilter === 'ALL' || txTypeFilter === 'INCOMES' || txTypeFilter === 'PAYABLES') {
      payables.forEach(p => {
        if (p.isCreditedToDebit && (p.issueDate || '').startsWith(monthKey)) {
          const searchMatches = !searchQuery || `prestamo recibido deuda ${p.creditorName} ${p.description}`.toLowerCase().includes(searchQuery.toLowerCase());
          if (searchMatches && selectedCategory === 'ALL' && selectedPaymentMethod === 'ALL') {
            const isUsd = p.currency === 'USD';
            const exRate = p.exchangeRate || 1;
            const orig = (isUsd && p.originalAmount) ? p.originalAmount : (p.originalAmount ?? p.totalAmount ?? 0);
            const penAmount = isUsd ? (p.amountPen || orig * exRate) : orig;
            items.push({
              kind: 'income',
              data: {
                id: `borrowed-${p.id}`,
                description: `Préstamo recibido: ${p.creditorName}${p.description ? ` - ${p.description}` : ''}`,
                amount: penAmount,
                date: p.issueDate,
                type: 'borrowed'
              },
              sortDate: p.issueDate
            });
          }
        }
      });
    }

    // 4. Pagos a Mis Deudas (Amortizaciones realizadas en el mes)
    if (txTypeFilter === 'ALL' || txTypeFilter === 'PAYABLES') {
      payables.forEach(p => {
        (p.payments || []).forEach(pay => {
          if (pay.paymentDate.startsWith(monthKey)) {
            const searchMatches = !searchQuery || `deuda ${p.creditorName} ${p.description} pago`.toLowerCase().includes(searchQuery.toLowerCase());
            const catMatches = selectedCategory === 'ALL';
            const methodMatches = selectedPaymentMethod === 'ALL' || pay.paymentMethodId === selectedPaymentMethod;
            if (searchMatches && catMatches && methodMatches) {
              items.push({
                kind: 'payable_payment',
                data: {
                  id: pay.id,
                  payableId: p.id,
                  creditorName: p.creditorName,
                  description: p.description,
                  amount: pay.amount,
                  currency: p.currency,
                  exchangeRate: p.exchangeRate,
                  paymentDate: pay.paymentDate,
                  notes: pay.notes,
                  createdAt: pay.createdAt
                },
                sortDate: pay.paymentDate
              });
            }
          }
        });
      });

      // Vencimientos programados de mis deudas (dueDate en el mes visible, con saldo
      // pendiente): se listan como "programado" para tenerlos en el radar, sin ser
      // aún un movimiento real. sortDate = fecha de vencimiento.
      payables.forEach(p => {
        if (!p.dueDate || !p.dueDate.startsWith(monthKey) || p.status === 'PAID') return;
        const rem = p.remainingAmount ?? (p.totalAmount ?? p.originalAmount ?? 0);
        if (rem <= 0) return;
        const remPen = p.currency === 'USD' ? rem * (p.exchangeRate || 1) : rem;
        const searchMatches = !searchQuery || `deuda ${p.creditorName} ${p.description} programado vencimiento`.toLowerCase().includes(searchQuery.toLowerCase());
        if (searchMatches && selectedCategory === 'ALL' && selectedPaymentMethod === 'ALL') {
          items.push({
            kind: 'scheduled_payable',
            data: {
              id: `sched-${p.id}`,
              payableId: p.id,
              creditorName: p.creditorName,
              description: p.description,
              amountPen: remPen,
              currency: p.currency,
              remaining: rem,
              dueDate: p.dueDate
            },
            sortDate: p.dueDate
          });
        }
      });
    }

    // 5. Cobros de Préstamos Otorgados (Ingresos recibidos por cobranzas a deudores)
    if (txTypeFilter === 'ALL' || txTypeFilter === 'INCOMES') {
      receivables.forEach(r => {
        const effectivePayments = (r.payments && r.payments.length > 0)
          ? r.payments
          : (r.paidAmount > 0 ? [{
              id: `legacy-rec-${r.id}`,
              receivableId: r.id,
              amount: r.paidAmount,
              amountPaid: r.paidAmount,
              paymentDate: getFallbackReceivablePaymentDate(r, monthKey, currentDateStr),
              paymentMethodId: 'pm-1',
              notes: 'Cobro de préstamo'
            }] : []);

        effectivePayments.forEach(pay => {
          if (pay.paymentDate.startsWith(monthKey)) {
            const searchMatches = !searchQuery || `cobro prestamo ${r.debtorName} ${r.description}`.toLowerCase().includes(searchQuery.toLowerCase());
            const catMatches = selectedCategory === 'ALL';
            const methodMatches = selectedPaymentMethod === 'ALL' || pay.paymentMethodId === selectedPaymentMethod;
            if (searchMatches && catMatches && methodMatches) {
              items.push({
                kind: 'receivable_payment',
                data: {
                  id: pay.id,
                  receivableId: r.id,
                  debtorName: r.debtorName,
                  description: r.description,
                  amount: pay.amount,
                  currency: r.currency,
                  exchangeRate: r.exchangeRate,
                  paymentDate: pay.paymentDate,
                  notes: pay.notes,
                  createdAt: pay.createdAt
                },
                sortDate: pay.paymentDate
              });
            }
          }
        });
      });
    }

    // Orden determinista: por fecha descendente y, ante empate (mismo día), por un
    // texto/id estable.
    const tieKey = (m: UnifiedMovement): string => {
      switch (m.kind) {
        case 'transaction': return `${m.data.description} ${m.data.id}`;
        case 'income': return `${m.data.description} ${m.data.id}`;
        case 'payable_payment': return `${m.data.creditorName} ${m.data.description} ${m.data.id}`;
        case 'receivable_payment': return `${m.data.debtorName} ${m.data.description} ${m.data.id}`;
        case 'card_payment': return `${m.data.paymentMethodId} ${m.data.id || m.index}`;
        case 'scheduled_payable': return `${m.data.creditorName} ${m.data.id}`;
      }
    };
    const getMovementCreatedAt = (m: UnifiedMovement): string => {
      switch (m.kind) {
        case 'transaction':
          return m.data.createdAt || (m.data.notes || '').match(/\[created:([^\]]+)\]/)?.[1] || '';
        case 'receivable_payment':
          return m.data.createdAt || (m.data.notes || '').match(/\[created:([^\]]+)\]/)?.[1] || '';
        case 'payable_payment':
          return m.data.createdAt || (m.data.notes || '').match(/\[created:([^\]]+)\]/)?.[1] || '';
        case 'card_payment':
          return (m.data.notes || '').match(/\[created:([^\]]+)\]/)?.[1] || '';
        case 'income':
          return m.data.createdAt || '';
        case 'scheduled_payable':
          return '';
      }
    };

    return items.sort((a, b) => {
      const dateDiff = new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      const caA = getMovementCreatedAt(a);
      const caB = getMovementCreatedAt(b);
      const createdDiff = caB.localeCompare(caA);
      if (createdDiff !== 0) return createdDiff;
      return tieKey(a).localeCompare(tieKey(b));
    });
  }, [txTypeFilter, filteredTransactions, currentMonthCardPayments, paymentMethods, searchQuery, selectedCategory, selectedPaymentMethod, salaries, monthKey, currentOtherIncomes, payables, receivables, currentDateStr]);

  // Total de movimientos del mes SIN filtros — fuente única para el badge de "Movimientos"
  const monthMovementsTotal = useMemo(() => {
    const payablePaymentsThisMonth = payables.reduce(
      (acc, p) => acc + (p.payments || []).filter(pay => pay.paymentDate.startsWith(monthKey)).length,
      0
    );
    const borrowedCreditsThisMonth = payables.filter(
      p => p.isCreditedToDebit && (p.issueDate || '').startsWith(monthKey)
    ).length;
    const receivablePaymentsThisMonth = receivables.reduce((acc, r) => {
      const effPayments = (r.payments && r.payments.length > 0)
        ? r.payments
        : (r.paidAmount > 0 ? [{ paymentDate: getFallbackReceivablePaymentDate(r, monthKey, currentDateStr) }] : []);
      return acc + effPayments.filter(pay => pay.paymentDate.startsWith(monthKey)).length;
    }, 0);
    const validOtherIncomesCount = currentOtherIncomes.filter(oi => !oi.id?.startsWith('inc-loan-')).length;

    return (
      currentMonthTransactions.length +
      currentMonthCardPayments.length +
      salaries.length +
      validOtherIncomesCount +
      borrowedCreditsThisMonth +
      payablePaymentsThisMonth +
      receivablePaymentsThisMonth
    );
  }, [currentMonthTransactions, currentMonthCardPayments, salaries, currentOtherIncomes, payables, receivables, monthKey, currentDateStr]);

  // Métricas Consolidadas de Préstamos y Deudas con Paridad Cambiaria
  const netLoansBalance = useMemo(() => {
    return totalReceivablesRemaining - totalPayablesRemaining;
  }, [totalReceivablesRemaining, totalPayablesRemaining]);

  // Separador Temporal "HOY" en Movimientos
  const isCurrentMonthViewed = currentYear === new Date().getFullYear() && currentMonth === (new Date().getMonth() + 1);
  const todayDividerIndex = useMemo(() => {
    if (!isCurrentMonthViewed) return -1;
    return combinedMovements.findIndex(item => item.sortDate <= currentDateStr);
  }, [isCurrentMonthViewed, combinedMovements, currentDateStr]);

  const monthNames = MONTH_NAMES;

  const handleOpenEditCard = (card: PaymentMethod) => {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardLimit(card.creditLimit ? card.creditLimit.toString() : '');
    setEditCardCloseDay(card.billingCloseDay ? card.billingCloseDay.toString() : '20');
    setEditCardDueDay(card.paymentDueDay ? card.paymentDueDay.toString() : '15');
    setEditCardColor(card.color || '#2563eb');
    setEditCardInitialDebt(card.initialDebt !== undefined && card.initialDebt !== null ? card.initialDebt.toString() : '');
    setIsEditCardModalOpen(true);
  };

  const handleSaveEditCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCardId || !editCardName) return;

    const targetPm = paymentMethods.find(p => p.id === editingCardId);
    if (targetPm) {
      const updatedPm: PaymentMethod = {
        ...targetPm,
        name: editCardName,
        creditLimit: editCardLimit ? parseFloat(editCardLimit) : targetPm.creditLimit,
        billingCloseDay: editCardCloseDay ? parseInt(editCardCloseDay, 10) : targetPm.billingCloseDay,
        paymentDueDay: editCardDueDay ? parseInt(editCardDueDay, 10) : targetPm.paymentDueDay,
        color: editCardColor,
        initialDebt: editCardInitialDebt ? parseFloat(editCardInitialDebt) : 0
      };
      setPaymentMethods(prev =>
        prev.map(pm => (pm.id === editingCardId ? updatedPm : pm))
      );
      // PUT a Supabase en la nube
      SupabaseDataService.updatePaymentMethod(updatedPm);
    }

    setIsEditCardModalOpen(false);
    setEditingCardId(null);
  };

  const promptDeleteTransaction = (t: Transaction) => {
    const cat = categories.find(c => c.id === t.categoryId);
    const pm = resolvePaymentMethod(t, paymentMethods);
    let futureCount = 0;
    if (t.isFixedSubscription) {
      const normDesc = t.description.trim().toLowerCase();
      futureCount = transactions.filter(tx =>
        tx.id !== t.id &&
        tx.isFixedSubscription &&
        tx.description.trim().toLowerCase() === normDesc &&
        (tx.categoryId === t.categoryId || tx.paymentMethodId === t.paymentMethodId) &&
        tx.date > t.date
      ).length;
    }
    setItemToDelete({
      id: t.id,
      type: 'transaction',
      description: t.description,
      amount: t.amountPen,
      currency: t.currency,
      date: t.date,
      categoryName: cat?.name,
      paymentMethodName: pm?.name,
      paymentMethodColor: pm?.color,
      isFixed: t.isFixedSubscription,
      futureOccurrencesCount: futureCount
    });
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'transaction') {
      deleteTransactionById(itemToDelete.id);
    } else if (itemToDelete.type === 'income') {
      deleteExtraIncome(itemToDelete.id);
    } else if (itemToDelete.type === 'receivable') {
      deleteReceivable(itemToDelete.id);
    }
    setItemToDelete(null);
  };

  const handleConfirmDeleteFuture = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'transaction') {
      deleteTransactionAndFuture(itemToDelete.id);
    } else if (itemToDelete.type === 'income') {
      deleteExtraIncome(itemToDelete.id);
    } else if (itemToDelete.type === 'receivable') {
      deleteReceivable(itemToDelete.id);
    }
    setItemToDelete(null);
  };

  const handleDeleteTransaction = (id: string) => {
    const t = transactions.find(tx => tx.id === id);
    if (t) {
      promptDeleteTransaction(t);
    } else {
      deleteTransactionById(id);
    }
  };

  // Fija un override manual del saldo inicial del mes (ancla la cadena en este mes).
  // El input vive local en AdjustDebitModal.
  const adjustDebit = (value: string) => {
    const newBal = Math.round((parseFloat(value || '0') || 0) * 100) / 100;
    setInitialDebitBalances(prev => ({
      ...prev,
      [monthKey]: newBal
    }));
    // Sincronizar saldo de débito en Supabase
    SupabaseDataService.updateInitialDebitBalance(currentYear, currentMonth, newBal);
    setIsAdjustDebitModalOpen(false);
  };

  // Restaura el arrastre automático: elimina el override manual del mes para que el
  // saldo inicial vuelva a derivarse del cierre del mes anterior. Persistimos 0 en la
  // nube (el cargador trata > 0 como override, así que 0 equivale a "sin override").
  const clearDebitOverride = () => {
    setInitialDebitBalances(prev => {
      if (!(monthKey in prev)) return prev;
      const next = { ...prev };
      delete next[monthKey];
      return next;
    });
    SupabaseDataService.updateInitialDebitBalance(currentYear, currentMonth, 0);
    setIsAdjustDebitModalOpen(false);
  };

  // Crea una tarjeta/medio de pago. El estado del formulario vive local en CardModal.
  const createCard = (data: {
    name: string;
    type: 'credit' | 'debit';
    closeDay: string;
    dueDay: string;
    limit: string;
    color: string;
    initialDebt: string;
  }) => {
    if (!data.name) return;

    const newCard: PaymentMethod = {
      id: generateUUID(),
      name: data.name,
      type: data.type,
      billingCloseDay: data.type === 'credit' ? parseInt(data.closeDay, 10) : undefined,
      paymentDueDay: data.type === 'credit' ? parseInt(data.dueDay, 10) : undefined,
      color: data.color,
      icon: data.type === 'credit' ? 'CreditCard' : 'Banknote',
      isActive: true,
      creditLimit: parseFloat(data.limit || '0'),
      initialDebt: data.initialDebt ? parseFloat(data.initialDebt) : 0
    };

    setPaymentMethods(prev => [...prev, newCard]);
    // POST a Supabase en la nube
    SupabaseDataService.createPaymentMethod(newCard);
    setIsCardModalOpen(false);
  };

  const renderTodayDividerRow = (keySuffix: string | number) => (
    <tr key={`today-divider-${keySuffix}`} className="today-divider-row">
      <td colSpan={6}>
        <div className="today-divider-container">
          <div className="today-divider-line" />
          <div className="today-divider-badge">
            <span className="today-pulse-dot" />
            <span>HOY ({formatDisplayDate(currentDateStr)}) — Movimientos Registrados Hasta la Fecha</span>
          </div>
          <div className="today-divider-line" />
        </div>
      </td>
    </tr>
  );

  const renderTodayDividerMobile = (keySuffix: string | number) => (
    <div key={`today-mobile-divider-${keySuffix}`} className="today-divider-container" style={{ margin: '14px 0 10px' }}>
      <div className="today-divider-line" />
      <div className="today-divider-badge">
        <span className="today-pulse-dot" />
        <span>HOY ({formatDisplayDate(currentDateStr)})</span>
      </div>
      <div className="today-divider-line" />
    </div>
  );

  return {
    // Usuario / sesión
    currentUser,
    handleLogout,

    // Recarga de datos (pull-to-refresh) y estados de carga
    reloadData,
    isInitialLoading,
    isRefreshingData,

    // Tema
    theme,
    toggleTheme,

    // Navegación de pestañas
    activeTab,
    setActiveTab,
    loansSubTab,
    setLoansSubTab,

    // Navegación de mes
    currentYear,
    currentMonth,
    isMonthDropdownOpen,
    setIsMonthDropdownOpen,
    monthPickerRef,
    handlePrevMonth,
    handleNextMonth,
    handleGoToCurrentMonth,
    handleSelectMonth,
    monthNames,

    // Contexto temporal derivado
    now,
    monthKey,
    isCurrentActiveMonth,
    isPastMonth,
    isFutureMonth,
    isCurrentMonthViewed,
    currentDateStr,

    // Saldo débito inicial
    initialDebitBalances,
    setInitialDebitBalances,
    initialDebitForMonth,
    isInitialDebitAuto,
    adjustDebit,
    clearDebitOverride,

    // Medios de pago y categorías
    paymentMethods,
    setPaymentMethods,
    categories,
    setCategories,

    // Filtros de movimientos
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    txTypeFilter,
    setTxTypeFilter,

    // Anomalías IA
    dismissedAnomalyIds,
    setDismissedAnomalyIds,
    handleDismissAnomaly,
    handleResetDismissedAnomalies,

    // Modales varios
    isCardModalOpen,
    setIsCardModalOpen,
    isAdjustDebitModalOpen,
    setIsAdjustDebitModalOpen,
    itemToDelete,
    setItemToDelete,
    handleConfirmDelete,
    handleConfirmDeleteFuture,
    debtConfirmData,
    setDebtConfirmData,

    // Backdrop de modales
    handleBackdropMouseDown,
    handleBackdropClick,

    // Editar tarjeta
    isEditCardModalOpen,
    setIsEditCardModalOpen,
    editingCardId,
    setEditingCardId,
    editCardName,
    setEditCardName,
    editCardType,
    setEditCardType,
    editCardLimit,
    setEditCardLimit,
    editCardCloseDay,
    setEditCardCloseDay,
    editCardDueDay,
    setEditCardDueDay,
    editCardColor,
    setEditCardColor,
    editCardInitialDebt,
    setEditCardInitialDebt,
    handleOpenEditCard,
    handleSaveEditCard,

    // Crear tarjeta
    createCard,

    // Analítica / proyecciones
    forecastHorizon,
    setForecastHorizon,
    isMoreMenuOpen,
    setIsMoreMenuOpen,
    cardsSubTab,
    setCardsSubTab,

    // Transacciones
    transactions,
    setTransactions,
    editingTransactionId,
    setEditingTransactionId,
    isExpenseModalOpen,
    setIsExpenseModalOpen,
    desc,
    setDesc,
    amount,
    setAmount,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    isFetchingTc,
    tcInfo,
    setHasUserManuallyEditedTc,
    isSubmittingExpense,
    isScanningReceipt,
    scanReceiptError,
    isParsingNaturalExpense,
    naturalExpenseError,
    modalNaturalText,
    setModalNaturalText,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedMethodId,
    setSelectedMethodId,
    isRecurring,
    setIsRecurring,
    overrideDueDate,
    setOverrideDueDate,
    txDate,
    setTxDate,
    isRefundMode,
    setIsRefundMode,
    isInstallment,
    setIsInstallment,
    installmentsCount,
    setInstallmentsCount,
    hasInterest,
    setHasInterest,
    monthlyInstallmentAmount,
    setMonthlyInstallmentAmount,
    aiSuggestion,
    setAiSuggestion,
    currentMonthTransactions,
    modalDueDateDetail,
    modalCalculatedDueDate,
    fetchSunatRate,
    handleOpenCreateTransaction,
    handleOpenEditTransaction,
    handleScanReceiptFile,
    handleParseNaturalExpense,
    handleCreateTransaction,
    deleteTransactionById,
    deleteTransactionAndFuture,
    handleDeleteTransaction,
    promptDeleteTransaction,

    // Ingresos
    salaries,
    setSalaries,
    extraIncomes,
    setExtraIncomes,
    currentOtherIncomes,
    totalSalaryAmount,
    isIncomeModalOpen,
    setIsIncomeModalOpen,
    isSalaryModalOpen,
    setIsSalaryModalOpen,
    salarySource,
    setSalarySource,
    salaryAmount,
    setSalaryAmount,
    salaryPayDay,
    setSalaryPayDay,
    addExtraIncome,
    creditLoanIncome,
    deleteExtraIncome,
    handleSaveSalary,

    // Abonos a tarjetas
    cardPayments,
    setCardPayments,
    currentMonthCardPayments,
    isPaymentModalOpen,
    setIsPaymentModalOpen,
    paymentSourceType,
    setPaymentSourceType,
    paymentCardId,
    setPaymentCardId,
    paymentAmount,
    setPaymentAmount,
    paymentCurrency,
    setPaymentCurrency,
    paymentExchangeRate,
    setPaymentExchangeRate,
    paymentTcInfo,
    hasUserManuallyEditedPaymentTc,
    setHasUserManuallyEditedPaymentTc,
    isFetchingPaymentTc,
    fetchPaymentSunatRate,
    paymentDate,
    setPaymentDate,
    editingCardPaymentId,
    editingCardPaymentIndex,
    showAllHistoricalPayments,
    setShowAllHistoricalPayments,
    handleOpenCreateCardPayment,
    handleOpenEditCardPayment,
    handleMakeCardPayment,
    handleClosePaymentModal,
    handleDeleteCardPayment,

    // Cuentas por cobrar
    receivables,
    setReceivables,
    isReceivableModalOpen,
    setIsReceivableModalOpen,
    editingReceivableId,
    setEditingReceivableId,
    handleOpenEditReceivable,
    isCollectModalOpen,
    setIsCollectModalOpen,
    collectingRec,
    collectingDebtorGroup,
    collectAmountInput,
    setCollectAmountInput,
    collectPaymentDate,
    setCollectPaymentDate,
    collectPaymentNotes,
    setCollectPaymentNotes,
    expandedDebtors,
    setExpandedDebtors,
    receivablesFilter,
    setReceivablesFilter,
    debtorName,
    setDebtorName,
    loanDesc,
    setLoanDesc,
    loanAmount,
    setLoanAmount,
    loanCurrency,
    setLoanCurrency,
    loanExchangeRate,
    setLoanExchangeRate,
    loanDate,
    setLoanDate,
    loanIsDebitedFromAccount,
    setLoanIsDebitedFromAccount,
    loanPaymentMethodId,
    setLoanPaymentMethodId,
    isFetchingLoanTc,
    loanTcInfo,
    setHasUserManuallyEditedLoanTc,
    fetchLoanSunatRate,
    debtorGroups,
    filteredDebtorGroups,
    totalReceivablesRemaining,
    totalReceivablesRemainingUsd,
    handleOpenCollectModal,
    handleOpenGroupCollectModal,
    handleCascadeCollect,
    handleCollectReceivable,
    handleSaveCollect,
    handleOpenAddLoanForDebtor,
    toggleDebtorExpanded,
    handleCreateReceivable,
    deleteReceivable,
    isEditCollectModalOpen,
    setIsEditCollectModalOpen,
    editingCollectRecId,
    editingCollectPaymentId,
    editCollectPaymentDate,
    setEditCollectPaymentDate,
    editCollectPaymentNotes,
    setEditCollectPaymentNotes,
    editCollectAmount,
    setEditCollectAmount,
    editCollectDebtorName,
    handleOpenEditCollectPayment,
    handleSaveEditCollectPayment,
    handleDeleteCollectPayment,

    // Mis deudas
    payables,
    setPayables,
    isPayableModalOpen,
    setIsPayableModalOpen,
    editingPayableId,
    setEditingPayableId,
    handleOpenEditPayable,
    isPayablePaymentModalOpen,
    setIsPayablePaymentModalOpen,
    payingPayable,
    payableCreditorName,
    setPayableCreditorName,
    payableDesc,
    setPayableDesc,
    payableAmount,
    setPayableAmount,
    payableDueDate,
    setPayableDueDate,
    payableIsCreditedToDebit,
    setPayableIsCreditedToDebit,
    payablePaymentAmount,
    setPayablePaymentAmount,
    payablePaymentDate,
    setPayablePaymentDate,
    payablePaymentNotes,
    setPayablePaymentNotes,
    payableCurrency,
    setPayableCurrency,
    payableExchangeRate,
    setPayableExchangeRate,
    payableIssueDate,
    setPayableIssueDate,
    isFetchingPayableTc,
    payableTcInfo,
    setHasUserManuallyEditedPayableTc,
    fetchPayableSunatRate,
    expandedCreditors,
    setExpandedCreditors,
    payablesFilter,
    setPayablesFilter,
    payingCreditorGroup,
    creditorGroups,
    filteredCreditorGroups,
    totalPayablesRemaining,
    totalPayablesRemainingUsd,
    handleOpenCreatePayable,
    handleCreatePayable,
    handleOpenAddLoanForCreditor,
    toggleCreditorExpanded,
    handleOpenGroupPayModal,
    handleCascadePay,
    handleOpenPayPayable,
    handlePayPayable,
    handleDeletePayable,
    navigateToPayableCreditor,
    navigateToDebtor,

    // Conciliación bancaria
    isParsingStatement,
    reconciliationSummary,
    setReconciliationSummary,
    reconciliationFilter,
    setReconciliationFilter,
    statementFileName,
    setStatementFileName,
    handleStatementFileUpload,
    handleImportStatementItem,
    handleImportAllUnmatched,

    // Cálculos derivados
    budget,
    debitStats,
    prevMonthClosingBalance,
    monthlyComparison,
    diagnostic,
    financialHealth,
    cardAdvisor,
    cardDebtSummary,
    cardPaymentPlan,
    categoryBreakdown,
    annualCategoryBreakdown,
    fixedExpensesTotal,
    forecastData,
    aiAnomalies,
    monthlyHistoricalFlow,
    filteredTransactions,
    combinedMovements,
    monthMovementsTotal,
    netLoansBalance,
    todayDividerIndex,

    // Helpers de formato / resolución (expuestos para consumidores)
    resolvePaymentMethod,
    formatDisplayDate,
    formatSoles,
    renderTodayDividerRow,
    renderTodayDividerMobile
  };
}

export type FinanceContextValue = ReturnType<typeof useFinanceController>;

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const value = useFinanceController();
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance debe usarse dentro de un <FinanceProvider>');
  }
  return ctx;
}
