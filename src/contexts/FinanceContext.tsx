'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
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
import { generateUUID, resolvePaymentMethod, deduplicateTransactions } from '@/lib/utils';
import {
  getBestCardRecommendation,
  calculateMonthlyDiagnostic,
  calculateCardsDebtSummary,
  calculateCurrentDebitBalance,
  formatDisplayDate,
  formatSoles
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

  useEffect(() => {
    // Require an authenticated user; otherwise bounce to login.
    const user = AuthService.getCurrentUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setCurrentUser(user);

    // Hydrate account data from Supabase (single source of truth). Month-scoped
    // data (transactions, incomes, card payments, period) loads in the effect below.
    SupabaseDataService.getPaymentMethods().then(methods => {
      if (methods && methods.length > 0) {
        setPaymentMethods(prev => methods.map(m => {
          const known = prev.find(p => p.id === m.id);
          // El valor de la nube (ya persistido) manda; caemos al local solo si la
          // columna aún no existe en la BD y la nube no lo trajo.
          return { ...m, initialDebt: m.initialDebt ?? known?.initialDebt ?? 0 };
        }));
      } else if (methods && methods.length === 0) {
        // Brand-new account: seed the generic starter methods in the cloud.
        initialPaymentMethods.forEach(pm => SupabaseDataService.createPaymentMethod(pm));
      }
    });
    SupabaseDataService.getReceivables().then(recs => {
      if (recs && recs.length > 0) setReceivables(recs);
    });
    SupabaseDataService.getPayables().then(pays => {
      if (pays && pays.length > 0) setPayables(pays);
    });
    SupabaseDataService.getCategories().then(cats => {
      if (cats && cats.length > 0) setCategories(cats);
    });
  }, [router]);

  const handleLogout = async () => {
    await AuthService.logout();
    window.location.href = '/login';
  };


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
  } | null>(null);

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

  const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  const initialDebitForMonth = initialDebitBalances[monthKey] ?? 0;

  // Contexto temporal del mes visible (usado por hooks de datos y cálculos)
  const now = new Date();
  const isCurrentActiveMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);
  const isPastMonth = currentYear < now.getFullYear() || (currentYear === now.getFullYear() && currentMonth < (now.getMonth() + 1));
  const isFutureMonth = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > (now.getMonth() + 1));
  const currentDateStr = isCurrentActiveMonth
    ? `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    : isPastMonth
    ? `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`
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
    deleteTransactionById
  } = useTransactions({
    monthKey,
    currentUser,
    currentYear,
    currentMonth,
    isCurrentActiveMonth,
    currentDateStr,
    paymentMethods,
    categories
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
    isCollectModalOpen,
    setIsCollectModalOpen,
    collectingRec,
    collectingDebtorGroup,
    collectAmountInput,
    setCollectAmountInput,
    expandedDebtors,
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
    deleteReceivable
  } = useReceivables({ currentYear, currentMonth });

  // Mis deudas: dinero que me prestaron, agrupado por acreedor, con pagos
  const {
    payables,
    setPayables,
    isPayableModalOpen,
    setIsPayableModalOpen,
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
  } = usePayables({ currentYear, currentMonth, onCreditToDebit: creditLoanIncome });

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
  }, [monthKey, currentUser, currentYear, currentMonth]);

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
  }, [currentUser, setTransactions, setExtraIncomes, setCardPayments]);

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
    handleLoadDemoStatement,
    handleImportStatementItem,
    handleImportAllUnmatched
  } = useReconciliation({
    monthKey,
    categories,
    paymentMethods,
    currentMonthTransactions,
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

    return calculateCurrentDebitBalance(
      initialDebitForMonth,
      salaries,
      currentOtherIncomes,
      receivables,
      currentMonthTransactions,
      debitMethodIds,
      cardPaymentsThisMonthTotal,
      currentDateStr,
      payables
    );
  }, [initialDebitForMonth, salaries, currentOtherIncomes, receivables, currentMonthTransactions, paymentMethods, cardPayments, monthKey, currentDateStr, payables]);

  // Cálculo del saldo de cierre del mes anterior para sugerir en saldo inicial (sin saturar la vista)
  const prevMonthClosingBalance = useMemo(() => {
    let pYear = currentYear;
    let pMonth = currentMonth - 1;
    if (pMonth < 1) {
      pMonth = 12;
      pYear -= 1;
    }
    const pKey = `${pYear}-${pMonth.toString().padStart(2, '0')}`;

    const prevInitial = initialDebitBalances[pKey] ?? 0;
    const prevTxs = transactions.filter(t => t.date.startsWith(pKey));
    const prevIncomes = extraIncomes[pKey] || [];
    const prevCardPayments = cardPayments.filter(p => p.paymentDate.startsWith(pKey));

    // Si el mes anterior no tiene saldo inicial ni movimientos registrados, no sugerir nada
    if (prevInitial === 0 && prevTxs.length === 0 && prevIncomes.length === 0 && prevCardPayments.length === 0) {
      return null;
    }

    const debitMethodIds = paymentMethods.filter(p => p.type === 'debit' || p.type === 'cash').map(p => p.id);
    const cardPaymentsTotal = prevCardPayments
      .filter(p => p.sourceType !== 'MERCHANT_REFUND' && p.sourceType !== 'BANK_CREDIT')
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const stats = calculateCurrentDebitBalance(
      prevInitial,
      salaries,
      prevIncomes,
      receivables,
      prevTxs,
      debitMethodIds,
      cardPaymentsTotal,
      `${pKey}-31`,
      payables
    );

    return {
      monthKey: pKey,
      monthName: MONTH_NAMES[pMonth],
      // Redondear a 2 decimales en el origen: evita arrastrar ruido binario de
      // punto flotante (p. ej. 3019.3799999999997) a los consumidores que copian
      // este valor tal cual al saldo inicial (botón "Traer cierre" / modal Editar).
      amount: Math.round(stats.projectedDebitBalanceMonthEnd * 100) / 100
    };
  }, [currentYear, currentMonth, initialDebitBalances, transactions, extraIncomes, cardPayments, paymentMethods, salaries, receivables, payables]);

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
      receivables,
      transactions
    );
  }, [budget, currentMonthTransactions, receivables, transactions]);

  // Asesor de tarjeta para el día 15
  const todayRef = useMemo(() => new Date(currentYear, currentMonth - 1, 15), [currentYear, currentMonth]);
  const cardAdvisor = useMemo(() => {
    return getBestCardRecommendation(paymentMethods, todayRef);
  }, [paymentMethods, todayRef]);

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
    const variableSum = variableTxs.reduce((acc, curr) => acc + curr.amountPen, 0);
    const creditCardIds = paymentMethods.filter(p => p.type === 'credit').map(p => p.id);

    return AIIntelligenceService.generateCashflowForecast(
      currentYear,
      currentMonth,
      debitStats.projectedDebitBalanceMonthEnd,
      salaries,
      fixedList,
      variableSum > 0 ? variableSum : 750,
      forecastHorizon,
      transactions,
      creditCardIds,
      extraIncomes,
      initialDebitBalances
    );
  }, [currentYear, currentMonth, debitStats.projectedDebitBalanceMonthEnd, salaries, transactions, currentMonthTransactions, monthKey, forecastHorizon, paymentMethods, extraIncomes, initialDebitBalances]);

  // Detección Inteligente de Anomalías y Cobros Duplicados (IA & NLP)
  const aiAnomalies = useMemo(() => {
    const detected = AIIntelligenceService.detectAnomalies(currentMonthTransactions, categories);
    return detected.filter(a => !dismissedAnomalyIds.includes(a.id));
  }, [currentMonthTransactions, categories, dismissedAnomalyIds]);

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
  }, [salaries, monthlySalaries, extraIncomes, transactions, monthKey, currentYear]);

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

  // Movimientos unificados para la tabla y feed táctil (Gastos, Pagos Tarjeta, Ingresos y Pagos de Deudas)
  type UnifiedMovement =
    | { kind: 'transaction'; data: Transaction; sortDate: string }
    | { kind: 'card_payment'; data: CardPayment; index: number; sortDate: string }
    | { kind: 'income'; data: { id: string; description: string; amount: number; date: string; type: 'salary' | 'extra' }; sortDate: string }
    | { kind: 'payable_payment'; data: { id: string; payableId: string; creditorName: string; description: string; amount: number; currency?: 'PEN' | 'USD'; exchangeRate?: number; paymentDate: string; notes?: string }; sortDate: string };

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
      salaries.forEach(sal => {
        const salDate = `${monthKey}-${sal.payDay.toString().padStart(2, '0')}`;
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
                  notes: pay.notes
                },
                sortDate: pay.paymentDate
              });
            }
          }
        });
      });
    }

    // Orden determinista: por fecha descendente y, ante empate (mismo día), por un
    // texto/id estable. Sin este desempate, el orden de pagos recurrentes del mismo
    // día variaba entre meses (dependía del orden de llegada desde la nube).
    const tieKey = (m: UnifiedMovement): string => {
      switch (m.kind) {
        case 'transaction': return `${m.data.description} ${m.data.id}`;
        case 'income': return `${m.data.description} ${m.data.id}`;
        case 'payable_payment': return `${m.data.creditorName} ${m.data.description} ${m.data.id}`;
        case 'card_payment': return `${m.data.paymentMethodId} ${m.data.id || m.index}`;
      }
    };
    return items.sort((a, b) => {
      const dateDiff = new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return tieKey(a).localeCompare(tieKey(b));
    });
  }, [txTypeFilter, filteredTransactions, currentMonthCardPayments, paymentMethods, searchQuery, selectedCategory, selectedPaymentMethod, salaries, monthKey, currentOtherIncomes, payables]);

  // Total de movimientos del mes SIN filtros — fuente única para el badge de "Movimientos"
  // (pestaña de navegación y cabecera del listado). Cuenta los cuatro tipos que alimentan
  // combinedMovements: gastos, pagos a tarjeta, ingresos (sueldos + extras) y pagos de deuda.
  const monthMovementsTotal = useMemo(() => {
    const payablePaymentsThisMonth = payables.reduce(
      (acc, p) => acc + (p.payments || []).filter(pay => pay.paymentDate.startsWith(monthKey)).length,
      0
    );
    return (
      currentMonthTransactions.length +
      currentMonthCardPayments.length +
      salaries.length +
      currentOtherIncomes.length +
      payablePaymentsThisMonth
    );
  }, [currentMonthTransactions, currentMonthCardPayments, salaries, currentOtherIncomes, payables, monthKey]);

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
      isFixed: t.isFixedSubscription
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

  const handleDeleteTransaction = (id: string) => {
    const t = transactions.find(tx => tx.id === id);
    if (t) {
      promptDeleteTransaction(t);
    } else {
      deleteTransactionById(id);
    }
  };

  // Ajusta el saldo débito inicial del mes. El input vive local en AdjustDebitModal.
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
      <td colSpan={8}>
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
    adjustDebit,

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
    isCollectModalOpen,
    setIsCollectModalOpen,
    collectingRec,
    collectingDebtorGroup,
    collectAmountInput,
    setCollectAmountInput,
    expandedDebtors,
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

    // Mis deudas
    payables,
    setPayables,
    isPayableModalOpen,
    setIsPayableModalOpen,
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

    // Conciliación bancaria
    isParsingStatement,
    reconciliationSummary,
    setReconciliationSummary,
    reconciliationFilter,
    setReconciliationFilter,
    statementFileName,
    setStatementFileName,
    handleStatementFileUpload,
    handleLoadDemoStatement,
    handleImportStatementItem,
    handleImportAllUnmatched,

    // Cálculos derivados
    budget,
    debitStats,
    prevMonthClosingBalance,
    monthlyComparison,
    diagnostic,
    cardAdvisor,
    cardDebtSummary,
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
