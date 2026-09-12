'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '@/styles/dashboard.css';
import { useTabNavigation, ActiveTab } from '@/hooks/useTabNavigation';
import { useMonthNavigation } from '@/hooks/useMonthNavigation';
import { useTheme } from '@/hooks/useTheme';
import { useReconciliation } from '@/hooks/useReconciliation';
import { useIncomes } from '@/hooks/useIncomes';
import { useCardPayments } from '@/hooks/useCardPayments';
import { useReceivables } from '@/hooks/useReceivables';
import { usePayables } from '@/hooks/usePayables';
import { useTransactions } from '@/hooks/useTransactions';
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
import { AnalyticsTab } from '@/components/tabs/AnalyticsTab';
import { ReconciliationTab } from '@/components/tabs/ReconciliationTab';
import { AnnualTab } from '@/components/tabs/AnnualTab';
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
  CardPayment,
  AIAnomaly,
  CashflowForecastMonth
} from '@/types';

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function DashboardPage() {
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

  return (
    <div className="dashboard-container">
      {/* 1. HEADER MODULAR CON CONTEXTO TEMPORAL GLOBAL */}
      <Header
        isCurrentActiveMonth={isCurrentActiveMonth}
        isPastMonth={isPastMonth}
        isFutureMonth={isFutureMonth}
        currentMonth={currentMonth}
        currentYear={currentYear}
        monthNames={monthNames}
        monthPickerRef={monthPickerRef}
        isMonthDropdownOpen={isMonthDropdownOpen}
        setIsMonthDropdownOpen={setIsMonthDropdownOpen}
        handleGoToCurrentMonth={handleGoToCurrentMonth}
        handlePrevMonth={handlePrevMonth}
        handleNextMonth={handleNextMonth}
        handleSelectMonth={handleSelectMonth}
        currentDebitBalance={isCurrentActiveMonth ? debitStats.currentDebitBalanceToday : debitStats.projectedDebitBalanceMonthEnd}
        handleOpenCreateTransaction={handleOpenCreateTransaction}
        theme={theme}
        toggleTheme={toggleTheme}
        currentUser={currentUser}
        handleLogout={handleLogout}
        formatSoles={formatSoles}
      />

      {/* 2. NAVEGACIÓN DESKTOP CON TABS Y URL DEEP LINKING */}
      <NavigationTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        salariesCount={salaries.length}
        otherIncomesCount={currentOtherIncomes.length}
        movementsCount={monthMovementsTotal}
        cardsCount={paymentMethods.length}
        pendingReceivablesCount={receivables.filter(r => r.remainingAmount > 0).length}
        pendingPayablesCount={payables.filter(p => p.remainingAmount > 0).length}
      />

      {/* =========================================================================
          CONTENIDO DINÁMICO SEGÚN PESTAÑA MODULAR
          ========================================================================= */}

      {/* PESTAÑA 1: VISIÓN GENERAL & GRÁFICOS */}
      {activeTab === 'overview' && (
        <OverviewTab
          isCurrentActiveMonth={isCurrentActiveMonth}
          isPastMonth={isPastMonth}
          isFutureMonth={isFutureMonth}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          monthKey={monthKey}
          now={now}
          debitStats={debitStats}
          initialDebitForMonth={initialDebitForMonth}
          totalSalaryAmount={totalSalaryAmount}
          currentOtherIncomes={currentOtherIncomes}
          setTempDebitBalance={setTempDebitBalance}
          setIsAdjustDebitModalOpen={setIsAdjustDebitModalOpen}
          prevMonthClosingBalance={prevMonthClosingBalance}
          setInitialDebitBalances={setInitialDebitBalances}
          diagnostic={diagnostic}
          fixedExpensesTotal={fixedExpensesTotal}
          currentMonthTransactions={currentMonthTransactions}
          categoryBreakdown={categoryBreakdown}
          monthlyComparison={monthlyComparison}
          setActiveTab={setActiveTab}
          paymentMethods={paymentMethods}
          categories={categories}
          resolvePaymentMethod={resolvePaymentMethod}
          handleOpenEditTransaction={handleOpenEditTransaction}
          promptDeleteTransaction={promptDeleteTransaction}
          cardAdvisor={cardAdvisor}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
        />
      )}

      {/* PESTAÑA 2: INGRESOS & SUELDOS */}
      {activeTab === 'incomes' && (
        <IncomesTab
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          setIsIncomeModalOpen={setIsIncomeModalOpen}
          setIsSalaryModalOpen={setIsSalaryModalOpen}
          totalSalaryAmount={totalSalaryAmount}
          currentOtherIncomes={currentOtherIncomes}
          debitStats={debitStats}
          salaries={salaries}
          setSalarySource={setSalarySource}
          setSalaryAmount={setSalaryAmount}
          setSalaryPayDay={setSalaryPayDay}
          setItemToDelete={setItemToDelete}
          fixedExpensesTotal={fixedExpensesTotal}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
        />
      )}

      {/* PESTAÑA 3: MOVIMIENTOS COMPLETOS */}
      {activeTab === 'transactions' && (
        <TransactionsTab
          currentDateStr={currentDateStr}
          combinedMovements={combinedMovements}
          monthMovementsTotal={monthMovementsTotal}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          txTypeFilter={txTypeFilter}
          setTxTypeFilter={setTxTypeFilter}
          currentMonthTransactions={currentMonthTransactions}
          currentMonthCardPayments={currentMonthCardPayments}
          salaries={salaries}
          currentOtherIncomes={currentOtherIncomes}
          payables={payables}
          monthKey={monthKey}
          selectedPaymentMethod={selectedPaymentMethod}
          setSelectedPaymentMethod={setSelectedPaymentMethod}
          paymentMethods={paymentMethods}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          handleOpenCreateCardPayment={handleOpenCreateCardPayment}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          isCurrentMonthViewed={isCurrentMonthViewed}
          todayDividerIndex={todayDividerIndex}
          renderTodayDividerRow={renderTodayDividerRow}
          renderTodayDividerMobile={renderTodayDividerMobile}
          handleOpenEditCardPayment={handleOpenEditCardPayment}
          handleDeleteCardPayment={handleDeleteCardPayment}
          resolvePaymentMethod={resolvePaymentMethod}
          handleOpenEditTransaction={handleOpenEditTransaction}
          promptDeleteTransaction={promptDeleteTransaction}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
          handleParseNaturalExpense={handleParseNaturalExpense}
          isParsingNaturalExpense={isParsingNaturalExpense}
        />
      )}

      {/* PESTAÑA 4: CUENTAS & TARJETAS (DÉBITO Y CRÉDITO) */}
      {activeTab === 'cards' && (
        <CardsTab
          handleOpenCreateCardPayment={handleOpenCreateCardPayment}
          setIsCardModalOpen={setIsCardModalOpen}
          setTempDebitBalance={setTempDebitBalance}
          initialDebitForMonth={initialDebitForMonth}
          setIsAdjustDebitModalOpen={setIsAdjustDebitModalOpen}
          debitStats={debitStats}
          cardDebtSummary={cardDebtSummary}
          paymentMethods={paymentMethods}
          handleOpenEditCard={handleOpenEditCard}
          showAllHistoricalPayments={showAllHistoricalPayments}
          setShowAllHistoricalPayments={setShowAllHistoricalPayments}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          cardPayments={cardPayments}
          currentMonthCardPayments={currentMonthCardPayments}
          handleOpenEditCardPayment={handleOpenEditCardPayment}
          handleDeleteCardPayment={handleDeleteCardPayment}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
        />
      )}

      {/* PESTAÑA 5: PRÉSTAMOS Y DEUDAS */}
      {activeTab === 'receivables' && (
        <ReceivablesTab
          totalReceivablesRemaining={totalReceivablesRemaining}
          totalPayablesRemaining={totalPayablesRemaining}
          totalReceivablesRemainingUsd={totalReceivablesRemainingUsd}
          totalPayablesRemainingUsd={totalPayablesRemainingUsd}
          receivables={receivables}
          payables={payables}
          loansSubTab={loansSubTab}
          setLoansSubTab={setLoansSubTab}
          setDebtorName={setDebtorName}
          setLoanDesc={setLoanDesc}
          setLoanAmount={setLoanAmount}
          setIsReceivableModalOpen={setIsReceivableModalOpen}
          receivablesFilter={receivablesFilter}
          setReceivablesFilter={setReceivablesFilter}
          debtorGroups={debtorGroups}
          filteredDebtorGroups={filteredDebtorGroups}
          expandedDebtors={expandedDebtors}
          toggleDebtorExpanded={toggleDebtorExpanded}
          handleOpenGroupCollectModal={handleOpenGroupCollectModal}
          handleCascadeCollect={handleCascadeCollect}
          handleOpenAddLoanForDebtor={handleOpenAddLoanForDebtor}
          handleOpenCollectModal={handleOpenCollectModal}
          setItemToDelete={setItemToDelete}
          handleOpenCreatePayable={handleOpenCreatePayable}
          payablesFilter={payablesFilter}
          setPayablesFilter={setPayablesFilter}
          creditorGroups={creditorGroups}
          filteredCreditorGroups={filteredCreditorGroups}
          expandedCreditors={expandedCreditors}
          toggleCreditorExpanded={toggleCreditorExpanded}
          handleOpenGroupPayModal={handleOpenGroupPayModal}
          handleCascadePay={handleCascadePay}
          handleOpenAddLoanForCreditor={handleOpenAddLoanForCreditor}
          handleOpenPayPayable={handleOpenPayPayable}
          handleDeletePayable={handleDeletePayable}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
        />
      )}

      {/* PESTAÑA 6: RESUMEN ANUAL */}
      {activeTab === 'annual' && (
        <AnnualTab
          monthlyHistoricalFlow={monthlyHistoricalFlow}
          categoryBreakdown={categoryBreakdown}
          formatSoles={formatSoles}
        />
      )}

      {/* PESTAÑA 7: ANALÍTICA AVANZADA, PROYECCIONES & IA */}
      {activeTab === 'analytics' && (
        <AnalyticsTab
          forecastHorizon={forecastHorizon}
          setForecastHorizon={setForecastHorizon}
          monthlyHistoricalFlow={monthlyHistoricalFlow}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          categoryBreakdown={categoryBreakdown}
          forecastData={forecastData}
          dismissedAnomalyIds={dismissedAnomalyIds}
          handleResetDismissedAnomalies={handleResetDismissedAnomalies}
          aiAnomalies={aiAnomalies}
          handleDismissAnomaly={handleDismissAnomaly}
          formatSoles={formatSoles}
          liquidityDiagnostic={diagnostic}
          totalSalaryAmount={totalSalaryAmount}
          totalReceivablesRemaining={totalReceivablesRemaining}
          totalPayablesRemaining={totalPayablesRemaining}
        />
      )}

      {/* PESTAÑA 8: CONCILIACIÓN BANCARIA INTELIGENTE */}
      {activeTab === 'reconciliation' && (
        <ReconciliationTab
          handleLoadDemoStatement={handleLoadDemoStatement}
          handleStatementFileUpload={handleStatementFileUpload}
          statementFileName={statementFileName}
          isParsingStatement={isParsingStatement}
          reconciliationSummary={reconciliationSummary}
          reconciliationFilter={reconciliationFilter}
          setReconciliationFilter={setReconciliationFilter}
          setReconciliationSummary={setReconciliationSummary}
          setStatementFileName={setStatementFileName}
          currentMonthTransactionsCount={currentMonthTransactions.length}
          creditCards={paymentMethods.filter(pm => pm.type === 'credit' && pm.isActive)}
          handleImportStatementItem={handleImportStatementItem}
          handleImportAllUnmatched={handleImportAllUnmatched}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
        />
      )}

      {/* =========================================================================
          MODALES DEL SISTEMA COMPLETO
          ========================================================================= */}

      {/* MODAL 1: REGISTRAR GASTO */}
      {isExpenseModalOpen && (
        <ExpenseModal
          onClose={() => setIsExpenseModalOpen(false)}
          onSubmit={handleCreateTransaction}
          editingTransactionId={editingTransactionId}
          isRefundMode={isRefundMode}
          setIsRefundMode={setIsRefundMode}
          isInstallment={isInstallment}
          setIsInstallment={setIsInstallment}
          modalNaturalText={modalNaturalText}
          setModalNaturalText={setModalNaturalText}
          isParsingNaturalExpense={isParsingNaturalExpense}
          handleParseNaturalExpense={handleParseNaturalExpense}
          handleScanReceiptFile={handleScanReceiptFile}
          isScanningReceipt={isScanningReceipt}
          scanReceiptError={scanReceiptError}
          desc={desc}
          setDesc={setDesc}
          aiSuggestion={aiSuggestion}
          setAiSuggestion={setAiSuggestion}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          isRecurring={isRecurring}
          setIsRecurring={setIsRecurring}
          amount={amount}
          setAmount={setAmount}
          currency={currency}
          setCurrency={setCurrency}
          exchangeRate={exchangeRate}
          setExchangeRate={setExchangeRate}
          tcInfo={tcInfo}
          isFetchingTc={isFetchingTc}
          setHasUserManuallyEditedTc={setHasUserManuallyEditedTc}
          fetchSunatRate={fetchSunatRate}
          selectedMethodId={selectedMethodId}
          setSelectedMethodId={setSelectedMethodId}
          paymentMethods={paymentMethods}
          categories={categories}
          txDate={txDate}
          setTxDate={setTxDate}
          installmentsCount={installmentsCount}
          setInstallmentsCount={setInstallmentsCount}
          hasInterest={hasInterest}
          setHasInterest={setHasInterest}
          monthlyInstallmentAmount={monthlyInstallmentAmount}
          setMonthlyInstallmentAmount={setMonthlyInstallmentAmount}
          overrideDueDate={overrideDueDate}
          setOverrideDueDate={setOverrideDueDate}
          modalCalculatedDueDate={modalCalculatedDueDate}
          modalDueDateDetail={modalDueDateDetail}
          isSubmittingExpense={isSubmittingExpense}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 2: AJUSTAR SALDO DÉBITO INICIAL */}
      {isAdjustDebitModalOpen && (
        <AdjustDebitModal
          onClose={() => setIsAdjustDebitModalOpen(false)}
          onSubmit={handleAdjustDebit}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          prevMonthClosingBalance={prevMonthClosingBalance}
          tempDebitBalance={tempDebitBalance}
          setTempDebitBalance={setTempDebitBalance}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
          formatSoles={formatSoles}
        />
      )}

      {/* MODAL: EDITAR TARJETA / MEDIO DE PAGO */}
      {isEditCardModalOpen && (
        <EditCardModal
          onClose={() => setIsEditCardModalOpen(false)}
          onSubmit={handleSaveEditCard}
          editCardName={editCardName}
          setEditCardName={setEditCardName}
          editCardColor={editCardColor}
          setEditCardColor={setEditCardColor}
          editCardLimit={editCardLimit}
          setEditCardLimit={setEditCardLimit}
          editCardInitialDebt={editCardInitialDebt}
          setEditCardInitialDebt={setEditCardInitialDebt}
          editCardCloseDay={editCardCloseDay}
          setEditCardCloseDay={setEditCardCloseDay}
          editCardDueDay={editCardDueDay}
          setEditCardDueDay={setEditCardDueDay}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL: REGISTRAR ABONO O COBRO PARCIAL A PRÉSTAMO */}
      {isCollectModalOpen && (collectingRec || collectingDebtorGroup) && (
        <CollectModal
          onClose={() => setIsCollectModalOpen(false)}
          onSubmit={handleSaveCollect}
          collectingRec={collectingRec}
          collectingDebtorGroup={collectingDebtorGroup}
          collectAmountInput={collectAmountInput}
          setCollectAmountInput={setCollectAmountInput}
          formatSoles={formatSoles}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 3: REGISTRAR INGRESO EXTRA A DÉBITO */}
      {isIncomeModalOpen && (
        <IncomeModal
          onClose={() => setIsIncomeModalOpen(false)}
          onSubmit={handleAddExtraIncome}
          incomeDesc={incomeDesc}
          setIncomeDesc={setIncomeDesc}
          incomeDate={incomeDate}
          setIncomeDate={setIncomeDate}
          incomeAmount={incomeAmount}
          setIncomeAmount={setIncomeAmount}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 4: NUEVA TARJETA PERSONALIZADA */}
      {isCardModalOpen && (
        <CardModal
          onClose={() => setIsCardModalOpen(false)}
          onSubmit={handleCreateCard}
          newCardName={newCardName}
          setNewCardName={setNewCardName}
          newCardType={newCardType}
          setNewCardType={setNewCardType}
          newCardColor={newCardColor}
          setNewCardColor={setNewCardColor}
          newCardLimit={newCardLimit}
          setNewCardLimit={setNewCardLimit}
          newCardCloseDay={newCardCloseDay}
          setNewCardCloseDay={setNewCardCloseDay}
          newCardDueDay={newCardDueDay}
          setNewCardDueDay={setNewCardDueDay}
          newCardInitialDebt={newCardInitialDebt}
          setNewCardInitialDebt={setNewCardInitialDebt}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 5: REGISTRAR O MODIFICAR ABONO / PAGO A TARJETA */}
      {isPaymentModalOpen && (
        <PaymentModal
          onClose={handleClosePaymentModal}
          onSubmit={handleMakeCardPayment}
          isEditing={editingCardPaymentIndex !== null}
          paymentMethods={paymentMethods}
          paymentCardId={paymentCardId}
          setPaymentCardId={setPaymentCardId}
          paymentSourceType={paymentSourceType}
          setPaymentSourceType={setPaymentSourceType}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          paymentDate={paymentDate}
          setPaymentDate={setPaymentDate}
          formatSoles={formatSoles}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 6: NUEVA CUENTA POR COBRAR */}
      {isReceivableModalOpen && (
        <ReceivableModal
          onClose={() => setIsReceivableModalOpen(false)}
          onSubmit={handleCreateReceivable}
          debtorName={debtorName}
          setDebtorName={setDebtorName}
          loanDesc={loanDesc}
          setLoanDesc={setLoanDesc}
          loanAmount={loanAmount}
          setLoanAmount={setLoanAmount}
          loanCurrency={loanCurrency}
          setLoanCurrency={setLoanCurrency}
          loanDate={loanDate}
          setLoanDate={setLoanDate}
          loanExchangeRate={loanExchangeRate}
          setLoanExchangeRate={setLoanExchangeRate}
          loanTcInfo={loanTcInfo}
          isFetchingLoanTc={isFetchingLoanTc}
          setHasUserManuallyEditedLoanTc={setHasUserManuallyEditedLoanTc}
          fetchLoanSunatRate={fetchLoanSunatRate}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 6B: REGISTRAR DEUDA MÍA (DINERO PRESTADO) */}
      {isPayableModalOpen && (
        <PayableModal
          onClose={() => setIsPayableModalOpen(false)}
          onSubmit={handleCreatePayable}
          payableCreditorName={payableCreditorName}
          setPayableCreditorName={setPayableCreditorName}
          payableDesc={payableDesc}
          setPayableDesc={setPayableDesc}
          payableAmount={payableAmount}
          setPayableAmount={setPayableAmount}
          payableCurrency={payableCurrency}
          setPayableCurrency={setPayableCurrency}
          payableIssueDate={payableIssueDate}
          setPayableIssueDate={setPayableIssueDate}
          payableExchangeRate={payableExchangeRate}
          setPayableExchangeRate={setPayableExchangeRate}
          payableTcInfo={payableTcInfo}
          isFetchingPayableTc={isFetchingPayableTc}
          setHasUserManuallyEditedPayableTc={setHasUserManuallyEditedPayableTc}
          payableDueDate={payableDueDate}
          setPayableDueDate={setPayableDueDate}
          payableIsCreditedToDebit={payableIsCreditedToDebit}
          setPayableIsCreditedToDebit={setPayableIsCreditedToDebit}
          fetchPayableSunatRate={fetchPayableSunatRate}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* MODAL 6C: REGISTRAR PAGO / AMORTIZACIÓN DE DEUDA MÍA */}
      {isPayablePaymentModalOpen && (payingPayable || payingCreditorGroup) && (
        <PayablePaymentModal
          onClose={() => setIsPayablePaymentModalOpen(false)}
          onSubmit={handlePayPayable}
          payingPayable={payingPayable}
          payingCreditorGroup={payingCreditorGroup}
          payablePaymentAmount={payablePaymentAmount}
          setPayablePaymentAmount={setPayablePaymentAmount}
          payablePaymentDate={payablePaymentDate}
          setPayablePaymentDate={setPayablePaymentDate}
          payablePaymentNotes={payablePaymentNotes}
          setPayablePaymentNotes={setPayablePaymentNotes}
          formatSoles={formatSoles}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* 11. MODAL: CONFIGURAR SUELDO / NÓMINA */}
      {isSalaryModalOpen && (
        <SalaryModal
          onClose={() => setIsSalaryModalOpen(false)}
          onSubmit={handleSaveSalary}
          salarySource={salarySource}
          setSalarySource={setSalarySource}
          salaryAmount={salaryAmount}
          setSalaryAmount={setSalaryAmount}
          salaryPayDay={salaryPayDay}
          setSalaryPayDay={setSalaryPayDay}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
        />
      )}

      {/* 3.6 MODAL DE CONFIRMACIÓN DE ELIMINACIÓN SEGURA */}
      {itemToDelete && (
        <DeleteConfirmModal
          item={itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleConfirmDelete}
          handleBackdropMouseDown={handleBackdropMouseDown}
          handleBackdropClick={handleBackdropClick}
          formatDisplayDate={formatDisplayDate}
          formatSoles={formatSoles}
        />
      )}

      {/* 4. NAVEGACIÓN MÓVIL MODULAR */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isMoreMenuOpen={isMoreMenuOpen}
        setIsMoreMenuOpen={setIsMoreMenuOpen}
        pendingReceivablesCount={receivables.filter(r => r.remainingAmount > 0).length}
        pendingPayablesCount={payables.filter(p => p.remainingAmount > 0).length}
        initialDebitForMonth={initialDebitForMonth}
        setTempDebitBalance={setTempDebitBalance}
        setIsAdjustDebitModalOpen={setIsAdjustDebitModalOpen}
        currentUser={currentUser}
        handleLogout={handleLogout}
        handleBackdropMouseDown={handleBackdropMouseDown}
        handleBackdropClick={handleBackdropClick}
      />
    </div>
  );
}
