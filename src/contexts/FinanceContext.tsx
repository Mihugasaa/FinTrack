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
import { generateUUID, resolvePaymentMethod } from '@/lib/utils';
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
          return { ...m, initialDebt: known?.initialDebt ?? m.initialDebt ?? 0 };
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


  // Form Ajustar Saldo Débito
  const [tempDebitBalance, setTempDebitBalance] = useState('0');

  // Form Nueva Tarjeta
  const [newCardName, setNewCardName] = useState('');
  const [newCardType, setNewCardType] = useState<'credit' | 'debit'>('credit');
  const [newCardCloseDay, setNewCardCloseDay] = useState('25');
  const [newCardDueDay, setNewCardDueDay] = useState('18');
  const [newCardLimit, setNewCardLimit] = useState('4000');
  const [newCardColor, setNewCardColor] = useState('#6366f1');
  const [newCardInitialDebt, setNewCardInitialDebt] = useState('');


  // Estados Fase 4: Analítica, Conciliación Bancaria y Sugerencias de IA
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6>(6);
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
    incomeDesc,
    setIncomeDesc,
    incomeAmount,
    setIncomeAmount,
    incomeDate,
    setIncomeDate,
    salarySource,
    setSalarySource,
    salaryAmount,
    setSalaryAmount,
    salaryPayDay,
    setSalaryPayDay,
    handleAddExtraIncome,
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

  const budget = {
    year: currentYear,
    month: currentMonth,
    baseSalary: totalSalaryAmount,
    salaries,
    initialDebitBalance: initialDebitForMonth,
    otherIncomes: currentOtherIncomes
  };

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
      amount: stats.projectedDebitBalanceMonthEnd
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
  const todayRef = new Date(currentYear, currentMonth - 1, 15);
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
      creditCardIds
    );
  }, [currentYear, currentMonth, debitStats.projectedDebitBalanceMonthEnd, salaries, transactions, currentMonthTransactions, monthKey, forecastHorizon, paymentMethods]);

  // Detección Inteligente de Anomalías y Cobros Duplicados (IA & NLP)
  const aiAnomalies = useMemo(() => {
    const detected = AIIntelligenceService.detectAnomalies(currentMonthTransactions, categories);
    return detected.filter(a => !dismissedAnomalyIds.includes(a.id));
  }, [currentMonthTransactions, categories, dismissedAnomalyIds]);

  // Evolución Histórica Multimes (para gráfico de barras y analítica dinámica)
  const monthlyHistoricalFlow = useMemo(() => {
    const baseSalary = salaries.reduce((acc, s) => acc + s.amount, 0) || 2126.49;

    const monthsDef = [
      { key: '2026-08', label: 'Ago 2026', baseOut: 266.50 },
      { key: '2026-09', label: 'Sep 2026', baseOut: 4140.19 },
      { key: '2026-10', label: 'Oct 2026', baseOut: 1812.21 },
      { key: '2026-11', label: 'Nov 2026', baseOut: 293.86 },
      { key: '2026-12', label: 'Dic 2026', baseOut: 293.86 }
    ];

    return monthsDef.map(m => {
      const extraList = extraIncomes[m.key] || [];
      const extraTotal = extraList.reduce((acc, curr) => acc + curr.amount, 0);
      const inVal = Number((baseSalary + extraTotal).toFixed(2));

      let outVal = m.baseOut;
      if (m.key === monthKey && diagnostic.realCashOutflow > 0) {
        outVal = Number(diagnostic.realCashOutflow.toFixed(2));
      }

      const savings = Number((inVal - outVal).toFixed(2));

      return {
        key: m.key,
        label: m.label,
        inVal,
        outVal,
        savings
      };
    });
  }, [salaries, extraIncomes, monthKey, diagnostic.realCashOutflow]);

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

    return items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
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

  const handleAdjustDebit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBal = parseFloat(tempDebitBalance || '0');
    setInitialDebitBalances(prev => ({
      ...prev,
      [monthKey]: newBal
    }));
    // Sincronizar saldo de débito en Supabase
    SupabaseDataService.updateInitialDebitBalance(currentYear, currentMonth, newBal);
    setIsAdjustDebitModalOpen(false);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName) return;

    const newCard: PaymentMethod = {
      id: generateUUID(),
      name: newCardName,
      type: newCardType,
      billingCloseDay: newCardType === 'credit' ? parseInt(newCardCloseDay, 10) : undefined,
      paymentDueDay: newCardType === 'credit' ? parseInt(newCardDueDay, 10) : undefined,
      color: newCardColor,
      icon: newCardType === 'credit' ? 'CreditCard' : 'Banknote',
      isActive: true,
      creditLimit: parseFloat(newCardLimit || '0'),
      initialDebt: newCardInitialDebt ? parseFloat(newCardInitialDebt) : 0
    };

    setPaymentMethods([...paymentMethods, newCard]);
    // POST a Supabase en la nube
    SupabaseDataService.createPaymentMethod(newCard);
    setIsCardModalOpen(false);
    setNewCardName('');
    setNewCardInitialDebt('');
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
    tempDebitBalance,
    setTempDebitBalance,
    handleAdjustDebit,

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
    newCardName,
    setNewCardName,
    newCardType,
    setNewCardType,
    newCardCloseDay,
    setNewCardCloseDay,
    newCardDueDay,
    setNewCardDueDay,
    newCardLimit,
    setNewCardLimit,
    newCardColor,
    setNewCardColor,
    newCardInitialDebt,
    setNewCardInitialDebt,
    handleCreateCard,

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
    incomeDesc,
    setIncomeDesc,
    incomeAmount,
    setIncomeAmount,
    incomeDate,
    setIncomeDate,
    salarySource,
    setSalarySource,
    salaryAmount,
    setSalaryAmount,
    salaryPayDay,
    setSalaryPayDay,
    handleAddExtraIncome,
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
