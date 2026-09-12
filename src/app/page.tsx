'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import '@/styles/dashboard.css';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Layers,
  Sun,
  Moon,
  PieChart,
  Calendar,
  ListFilter,
  Users,
  Trash2,
  Pencil,
  Repeat,
  AlertTriangle,
  Download,
  DollarSign,
  Wallet,
  TrendingDown,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Coins,
  Briefcase,
  Building2,
  Tag,
  Banknote,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  LogOut,
  Sparkles,
  UploadCloud,
  FileSpreadsheet,
  BarChart3,
  CheckCheck,
  HelpCircle,
  ShieldCheck,
  Columns,
  Camera
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { useTabNavigation, ActiveTab } from '@/hooks/useTabNavigation';
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
import { ReconciliationService } from '@/services/reconciliation.service';
import { ExchangeRateService, ExchangeRateResult } from '@/services/exchangeRate.service';
import {
  initialCategories,
  initialPaymentMethods
} from '@/lib/defaults';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR, FALLBACK_USD_PEN_RATE_STR4, CARD_COLOR_PRESETS } from '@/lib/constants';
import {
  calculatePaymentDueDate,
  calculatePaymentDueDateDetail,
  getBestCardRecommendation,
  calculateMonthlyDiagnostic,
  calculateCardsDebtSummary,
  calculateCurrentDebitBalance,
  generateInstallmentTransactions,
  formatDisplayDate,
  formatSoles
} from '@/lib/calculations';
import {
  Transaction,
  CurrencyCode,
  PaymentMethod,
  Receivable,
  Payable,
  PayablePayment,
  CreditorGroup,
  OtherIncome,
  SalaryIncome,
  CardPayment,
  StatementTransaction,
  ReconciliationSummary,
  ReconciliationItem,
  AIAnomaly,
  CashflowForecastMonth
} from '@/types';

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Generador de UUID estándar RFC4122 (compatible con Supabase)
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Deduplicador estricto por ID único (permite compras legítimas con misma tarjeta, monto y fecha)
const deduplicateTransactions = (list: Transaction[]): Transaction[] => {
  const seenIds = new Set<string>();
  const result: Transaction[] = [];

  for (const t of list) {
    if (!t || !t.id) continue;
    if (seenIds.has(t.id)) continue;
    seenIds.add(t.id);
    result.push(t);
  }
  return result;
};

// Resolver de método de pago con soporte de UUID, respaldo en notas [pmId:UUID] y compatibilidad hacia atrás
const resolvePaymentMethod = (
  tx: { paymentMethodId?: string; notes?: string | null },
  methods: PaymentMethod[]
): PaymentMethod | undefined => {
  if (tx.paymentMethodId) {
    const direct = methods.find(p => p.id === tx.paymentMethodId);
    if (direct) return direct;

    // Compatibilidad y puente entre IDs iniciales ('pm-1', 'pm-2', etc.) y UUIDs de Supabase
    const initialPm = initialPaymentMethods.find(ip => ip.id === tx.paymentMethodId);
    if (initialPm) {
      const matchByName = methods.find(p => p.name.toLowerCase() === initialPm.name.toLowerCase());
      if (matchByName) return matchByName;
    }
  }
  if (tx.notes) {
    const match = tx.notes.match(/\[pmId:([^\]]+)\]/);
    if (match && match[1]) {
      const fromNote = methods.find(p => p.id === match[1]);
      if (fromNote) return fromNote;
    }
  }
  if (tx.paymentMethodId === 'pm-1' || tx.paymentMethodId === 'pm-deb-1') {
    const deb = methods.find(p => p.type === 'debit');
    if (deb) return deb;
  }
  if (methods.length > 0) {
    return methods[0];
  }
  return undefined;
};

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // 1. Tema Claro / Oscuro (Predeterminado: Claro)
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

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

    // Theme is a per-device UI preference, kept in localStorage by design.
    const savedTheme = localStorage.getItem('fintrack_theme') as 'dark' | 'light' | null;
    const initial = savedTheme || 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, [router]);

  const handleLogout = async () => {
    await AuthService.logout();
    window.location.href = '/login';
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('fintrack_theme', nextTheme);
  };

  // 2. Pestaña Activa y Subpestañas (Sincronizadas con URL y localStorage)
  const {
    activeTab,
    setTab: setActiveTab,
    loanSubTab: loansSubTab,
    setLoanSubTab: setLoansSubTab
  } = useTabNavigation('overview');

  // 3. Mes y Año activo (Sincronizado en tiempo real con la fecha del sistema)
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1); // Septiembre = 9

  // 4. Saldo Débito Inicial configurable por el usuario (Dinero con el que arranca)
  const [initialDebitBalances, setInitialDebitBalances] = useState<Record<string, number>>({});

  // 5. Estados de Datos Interactivos
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(initialPaymentMethods);
  const [categories, setCategories] = useState(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [cardPayments, setCardPayments] = useState<CardPayment[]>([]);
  const [salaries, setSalaries] = useState<SalaryIncome[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<Record<string, OtherIncome[]>>({});

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
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  const [isAdjustDebitModalOpen, setIsAdjustDebitModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

  // Modales y formularios de Deudas y Préstamos
  const [isPayableModalOpen, setIsPayableModalOpen] = useState(false);
  const [isPayablePaymentModalOpen, setIsPayablePaymentModalOpen] = useState(false);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [payableCreditorName, setPayableCreditorName] = useState('');
  const [payableDesc, setPayableDesc] = useState('');
  const [payableAmount, setPayableAmount] = useState('');
  const [payableDueDate, setPayableDueDate] = useState('');
  const [payableIsCreditedToDebit, setPayableIsCreditedToDebit] = useState(false);
  const [payablePaymentAmount, setPayablePaymentAmount] = useState('');
  const [payablePaymentDate, setPayablePaymentDate] = useState('');
  const [payablePaymentNotes, setPayablePaymentNotes] = useState('');
  const [payableCurrency, setPayableCurrency] = useState<CurrencyCode>('PEN');
  const [payableExchangeRate, setPayableExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [payableIssueDate, setPayableIssueDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [isFetchingPayableTc, setIsFetchingPayableTc] = useState(false);
  const [payableTcInfo, setPayableTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedPayableTc, setHasUserManuallyEditedPayableTc] = useState(false);

  // Estados de Cuotas y Reembolso en Nuevo Gasto
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState('3');
  const [hasInterest, setHasInterest] = useState(false);
  const [monthlyInstallmentAmount, setMonthlyInstallmentAmount] = useState('');

  // Origen de Abono a Tarjeta
  const [paymentSourceType, setPaymentSourceType] = useState<'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT'>('DEBIT_ACCOUNT');

  // Estados de Edición y Cobro Parcial
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

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

  // Ref para cerrar selector de meses al hacer clic fuera
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardType, setEditCardType] = useState<'debit' | 'credit'>('credit');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardCloseDay, setEditCardCloseDay] = useState('20');
  const [editCardDueDay, setEditCardDueDay] = useState('15');
  const [editCardColor, setEditCardColor] = useState('#2563eb');
  const [editCardInitialDebt, setEditCardInitialDebt] = useState('');

  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectingRec, setCollectingRec] = useState<Receivable | null>(null);
  const [collectingDebtorGroup, setCollectingDebtorGroup] = useState<{
    debtorName: string;
    totalRemaining: number;
    items: Receivable[];
  } | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState('');
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set());
  const [receivablesFilter, setReceivablesFilter] = useState<'pending' | 'all' | 'paid'>('pending');
  const [expandedCreditors, setExpandedCreditors] = useState<Set<string>>(new Set());
  const [payablesFilter, setPayablesFilter] = useState<'pending' | 'all' | 'paid'>('pending');
  const [payingCreditorGroup, setPayingCreditorGroup] = useState<CreditorGroup | null>(null);

  // Forms
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('PEN');
  const [exchangeRate, setExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [isFetchingTc, setIsFetchingTc] = useState(false);
  const [tcInfo, setTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedTc, setHasUserManuallyEditedTc] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scanReceiptError, setScanReceiptError] = useState<string | null>(null);
  const [isParsingNaturalExpense, setIsParsingNaturalExpense] = useState(false);
  const [naturalExpenseError, setNaturalExpenseError] = useState<string | null>(null);
  const [modalNaturalText, setModalNaturalText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategories[2].id);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [overrideDueDate, setOverrideDueDate] = useState('');
  const [txDate, setTxDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  // Asegurar que el medio de pago seleccionado corresponda a una tarjeta activa del usuario actual
  useEffect(() => {
    if (paymentMethods.length > 0 && (!selectedMethodId || !paymentMethods.some(p => p.id === selectedMethodId))) {
      setSelectedMethodId(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedMethodId]);


  // Form Ajustar Saldo Débito
  const [tempDebitBalance, setTempDebitBalance] = useState('0');

  // Form Ingreso Extra
  const [incomeDesc, setIncomeDesc] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeDate, setIncomeDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });

  // Form Configurar Sueldo
  const [salarySource, setSalarySource] = useState('Empleo Principal (Nómina)');
  const [salaryAmount, setSalaryAmount] = useState('2126.49');
  const [salaryPayDay, setSalaryPayDay] = useState('30');

  // Form Nueva Tarjeta
  const [newCardName, setNewCardName] = useState('');
  const [newCardType, setNewCardType] = useState<'credit' | 'debit'>('credit');
  const [newCardCloseDay, setNewCardCloseDay] = useState('25');
  const [newCardDueDay, setNewCardDueDay] = useState('18');
  const [newCardLimit, setNewCardLimit] = useState('4000');
  const [newCardColor, setNewCardColor] = useState('#6366f1');
  const [newCardInitialDebt, setNewCardInitialDebt] = useState('');

  // Form Abono
  const [paymentCardId, setPaymentCardId] = useState(initialPaymentMethods[1].id);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [editingCardPaymentId, setEditingCardPaymentId] = useState<string | null>(null);
  const [editingCardPaymentIndex, setEditingCardPaymentIndex] = useState<number | null>(null);
  const [showAllHistoricalPayments, setShowAllHistoricalPayments] = useState(false);

  // Form Préstamo
  const [debtorName, setDebtorName] = useState('');
  const [loanDesc, setLoanDesc] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanCurrency, setLoanCurrency] = useState<CurrencyCode>('PEN');
  const [loanExchangeRate, setLoanExchangeRate] = useState(FALLBACK_USD_PEN_RATE_STR);
  const [loanDate, setLoanDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  });
  const [isFetchingLoanTc, setIsFetchingLoanTc] = useState(false);
  const [loanTcInfo, setLoanTcInfo] = useState<ExchangeRateResult | null>(null);
  const [hasUserManuallyEditedLoanTc, setHasUserManuallyEditedLoanTc] = useState(false);

  // Estados Fase 4: Analítica, Conciliación Bancaria y Sugerencias de IA
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6>(6);
  const [aiSuggestion, setAiSuggestion] = useState<{
    categoryId: string;
    categoryName: string;
    confidence: number;
    isFixedSuggestion: boolean;
  } | null>(null);
  const [isParsingStatement, setIsParsingStatement] = useState(false);
  const [reconciliationSummary, setReconciliationSummary] = useState<ReconciliationSummary | null>(null);
  const [reconciliationFilter, setReconciliationFilter] = useState<'all' | 'matched' | 'unmatched_app' | 'mismatch'>('all');
  const [statementFileName, setStatementFileName] = useState<string>('');

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToCurrentMonth = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth() + 1);
    setIsMonthDropdownOpen(false);
  };

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Cerrar selector de meses al hacer clic fuera
  useEffect(() => {
    const handleClickOutsideMonthPicker = (e: MouseEvent) => {
      if (isMonthDropdownOpen && monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    if (isMonthDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutsideMonthPicker);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideMonthPicker);
    };
  }, [isMonthDropdownOpen]);

  const handleSelectMonth = (m: number) => {
    setCurrentMonth(m);
    setIsMonthDropdownOpen(false);
  };

  const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  const initialDebitForMonth = initialDebitBalances[monthKey] ?? 0;
  const currentOtherIncomes = extraIncomes[monthKey] || [];

  // Sincronización de datos desde Supabase al cambiar de mes
  useEffect(() => {
    if (!currentUser) return;

    // 1. Transacciones (con deduplicación atómica nube-local y preservación de medio de pago y reembolsos)
    SupabaseDataService.getTransactions(monthKey).then(cloudTxs => {
      if (cloudTxs && cloudTxs.length > 0) {
        setTransactions(prev => {
          const enrichedCloud = cloudTxs.map(ct => {
            const localMatch = prev.find(lt => lt.id === ct.id || (
              lt.date === ct.date &&
              (lt.description || '').trim().toLowerCase() === (ct.description || '').trim().toLowerCase() &&
              Math.abs((lt.amountPen || 0) - (ct.amountPen || 0)) < 0.01
            ));

            let pmId = ct.paymentMethodId;
            if (!pmId && localMatch?.paymentMethodId) {
              pmId = localMatch.paymentMethodId;
            }
            if (!pmId && ct.notes) {
              const m = ct.notes.match(/\[pmId:([^\]]+)\]/);
              if (m && m[1]) pmId = m[1];
            }

            // Preservación blindada de Reembolsos / Abonos a favor (nube, notas y local)
            let isRefund = ct.isRefund;
            if (!isRefund) {
              if (localMatch?.isRefund) {
                isRefund = true;
              } else if (ct.notes && (ct.notes.includes('[isRefund:true]') || ct.notes.includes('[refund]'))) {
                isRefund = true;
              }
            }

            return { ...ct, paymentMethodId: pmId, isRefund: !!isRefund };
          });

          const cloudSigs = new Set(
            enrichedCloud.map(t => `${t.date}_${(t.description || '').trim().toLowerCase()}_${(t.amountPen || 0).toFixed(2)}_${t.paymentMethodId}`)
          );
          const cloudIds = new Set(enrichedCloud.map(t => t.id));
          const localOnly = prev.filter(t => !cloudIds.has(t.id) && !cloudSigs.has(`${t.date}_${(t.description || '').trim().toLowerCase()}_${(t.amountPen || 0).toFixed(2)}_${t.paymentMethodId}`));
          return deduplicateTransactions([...enrichedCloud, ...localOnly]);
        });
      }
    });

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

  const now = new Date();
  const isCurrentActiveMonth = currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1);
  const isPastMonth = currentYear < now.getFullYear() || (currentYear === now.getFullYear() && currentMonth < (now.getMonth() + 1));
  const isFutureMonth = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > (now.getMonth() + 1));
  const currentDateStr = isCurrentActiveMonth
    ? `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
    : isPastMonth
    ? `${currentYear}-${currentMonth.toString().padStart(2, '0')}-31`
    : `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;

  const totalSalaryAmount = salaries.reduce((acc, curr) => acc + curr.amount, 0);

  const budget = {
    year: currentYear,
    month: currentMonth,
    baseSalary: totalSalaryAmount,
    salaries,
    initialDebitBalance: initialDebitForMonth,
    otherIncomes: currentOtherIncomes
  };

  // Movimientos del mes seleccionado
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(monthKey));
  }, [transactions, monthKey]);

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
  const debtorGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      debtorName: string;
      totalOriginal: number;
      totalPaid: number;
      totalRemaining: number;
      totalOriginalUsd: number;
      totalPaidUsd: number;
      totalRemainingUsd: number;
      hasUsd: boolean;
      isPureUsd: boolean;
      items: Receivable[];
      isFullyPaid: boolean;
      paidPercentage: number;
    }>();

    receivables.forEach(r => {
      const trimmed = r.debtorName?.trim() || 'Desconocido';
      const key = trimmed.toLowerCase();
      const existing = map.get(key) || {
        key,
        debtorName: trimmed,
        totalOriginal: 0,
        totalPaid: 0,
        totalRemaining: 0,
        totalOriginalUsd: 0,
        totalPaidUsd: 0,
        totalRemainingUsd: 0,
        hasUsd: false,
        isPureUsd: true,
        items: [],
        isFullyPaid: false,
        paidPercentage: 0
      };

      const isUsd = r.currency === 'USD';
      const exRate = r.exchangeRate || FALLBACK_USD_PEN_RATE;
      const origPen = isUsd ? (r.amountPen || r.originalAmount * exRate) : r.originalAmount;
      const paidPen = isUsd ? (r.paidAmount * exRate) : r.paidAmount;
      const remPen = isUsd ? (r.remainingAmount * exRate) : r.remainingAmount;

      existing.totalOriginal += origPen;
      existing.totalPaid += paidPen;
      existing.totalRemaining += remPen;

      if (isUsd) {
        existing.hasUsd = true;
        existing.totalOriginalUsd += r.originalAmount;
        existing.totalPaidUsd += r.paidAmount;
        existing.totalRemainingUsd += r.remainingAmount;
      } else {
        existing.isPureUsd = false;
      }

      existing.items.push(r);
      map.set(key, existing);
    });

    return Array.from(map.values()).map(g => {
      g.items.sort((a, b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
      g.isFullyPaid = g.totalRemaining <= 0;
      g.paidPercentage = g.totalOriginal > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalOriginal) * 100)) : 0;
      return g;
    });
  }, [receivables]);

  // Grupos de Deudores Filtrados por Estado (Pendientes / Todos / Saldados)
  const filteredDebtorGroups = useMemo(() => {
    return debtorGroups.filter(g => {
      if (receivablesFilter === 'pending') return !g.isFullyPaid;
      if (receivablesFilter === 'paid') return g.isFullyPaid;
      return true;
    });
  }, [debtorGroups, receivablesFilter]);

  // Agrupación y Consolidación de Mis Deudas por Acreedor (Ficha de Acreedor)
  const creditorGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      creditorName: string;
      totalOriginal: number;
      totalPaid: number;
      totalRemaining: number;
      totalOriginalUsd: number;
      totalPaidUsd: number;
      totalRemainingUsd: number;
      hasUsd: boolean;
      isPureUsd: boolean;
      items: Payable[];
      isFullyPaid: boolean;
      paidPercentage: number;
    }>();

    payables.forEach(p => {
      const trimmed = p.creditorName?.trim() || 'Desconocido';
      const key = trimmed.toLowerCase();
      const existing = map.get(key) || {
        key,
        creditorName: trimmed,
        totalOriginal: 0,
        totalPaid: 0,
        totalRemaining: 0,
        totalOriginalUsd: 0,
        totalPaidUsd: 0,
        totalRemainingUsd: 0,
        hasUsd: false,
        isPureUsd: true,
        items: [],
        isFullyPaid: false,
        paidPercentage: 0
      };

      const isUsd = p.currency === 'USD';
      const orig = (isUsd && p.originalAmount) ? p.originalAmount : (p.originalAmount ?? p.totalAmount ?? 0);
      const paid = p.paidAmount ?? 0;
      const rem = (isUsd && p.remainingAmount > orig) ? Math.max(0, orig - paid) : (p.remainingAmount ?? orig);
      const exRate = p.exchangeRate || FALLBACK_USD_PEN_RATE;
      const origPen = isUsd ? (p.amountPen || orig * exRate) : orig;
      const paidPen = isUsd ? (paid * exRate) : paid;
      const remPen = isUsd ? (rem * exRate) : rem;

      existing.totalOriginal += origPen;
      existing.totalPaid += paidPen;
      existing.totalRemaining += remPen;

      if (isUsd) {
        existing.hasUsd = true;
        existing.totalOriginalUsd += orig;
        existing.totalPaidUsd += paid;
        existing.totalRemainingUsd += rem;
      } else {
        existing.isPureUsd = false;
      }

      existing.items.push(p);
      map.set(key, existing);
    });

    return Array.from(map.values()).map(g => {
      g.items.sort((a, b) => new Date(a.createdAt || a.issueDate || '').getTime() - new Date(b.createdAt || b.issueDate || '').getTime());
      g.isFullyPaid = g.totalRemaining <= 0;
      g.paidPercentage = g.totalOriginal > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalOriginal) * 100)) : 0;
      return g;
    });
  }, [payables]);

  // Grupos de Acreedores Filtrados por Estado (Pendientes / Todos / Saldados)
  const filteredCreditorGroups = useMemo(() => {
    return creditorGroups.filter(g => {
      if (payablesFilter === 'pending') return !g.isFullyPaid;
      if (payablesFilter === 'paid') return g.isFullyPaid;
      return true;
    });
  }, [creditorGroups, payablesFilter]);

  // Pagos a Tarjetas Realizados en el Mes Activo (Comprobantes de Salida Bancaria)
  const currentMonthCardPayments = useMemo(() => {
    const targetYM = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    return cardPayments
      .filter(p => p.paymentDate.startsWith(targetYM))
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  }, [cardPayments, currentYear, currentMonth]);

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
  const totalReceivablesRemaining = useMemo(() => {
    return receivables.reduce((acc, curr) => {
      const isUsd = curr.currency === 'USD';
      const exRate = curr.exchangeRate || FALLBACK_USD_PEN_RATE;
      const pen = isUsd ? (curr.amountPen ? (curr.remainingAmount / (curr.originalAmount || 1)) * curr.amountPen : curr.remainingAmount * exRate) : curr.remainingAmount;
      return acc + pen;
    }, 0);
  }, [receivables]);

  const totalReceivablesRemainingUsd = useMemo(() => {
    return receivables.filter(r => r.currency === 'USD').reduce((acc, curr) => acc + curr.remainingAmount, 0);
  }, [receivables]);

  const totalPayablesRemaining = useMemo(() => {
    return payables.reduce((acc, curr) => {
      const isUsd = curr.currency === 'USD';
      const orig = (isUsd && curr.originalAmount) ? curr.originalAmount : (curr.originalAmount ?? curr.totalAmount ?? 0);
      const paid = curr.paidAmount ?? 0;
      const rem = (isUsd && curr.remainingAmount > orig) ? Math.max(0, orig - paid) : (curr.remainingAmount ?? orig);
      const exRate = curr.exchangeRate || FALLBACK_USD_PEN_RATE;
      const pen = isUsd ? (curr.amountPen ? (rem / (orig || 1)) * curr.amountPen : rem * exRate) : rem;
      return acc + pen;
    }, 0);
  }, [payables]);

  const totalPayablesRemainingUsd = useMemo(() => {
    return payables.filter(p => p.currency === 'USD').reduce((acc, curr) => {
      const orig = curr.originalAmount ?? curr.totalAmount ?? 0;
      const paid = curr.paidAmount ?? 0;
      const rem = curr.remainingAmount > orig ? Math.max(0, orig - paid) : (curr.remainingAmount ?? orig);
      return acc + rem;
    }, 0);
  }, [payables]);

  const netLoansBalance = useMemo(() => {
    return totalReceivablesRemaining - totalPayablesRemaining;
  }, [totalReceivablesRemaining, totalPayablesRemaining]);

  // Separador Temporal "HOY" en Movimientos
  const isCurrentMonthViewed = currentYear === new Date().getFullYear() && currentMonth === (new Date().getMonth() + 1);
  const todayDividerIndex = useMemo(() => {
    if (!isCurrentMonthViewed) return -1;
    return combinedMovements.findIndex(item => item.sortDate <= currentDateStr);
  }, [isCurrentMonthViewed, combinedMovements, currentDateStr]);

  const modalDueDateDetail = useMemo(() => {
    const method = paymentMethods.find(p => p.id === selectedMethodId);
    return calculatePaymentDueDateDetail(txDate, method);
  }, [txDate, selectedMethodId, paymentMethods]);

  const modalCalculatedDueDate = modalDueDateDetail.dueDate;

  const monthNames = MONTH_NAMES;

  // Consulta de Tipo de Cambio Oficial SUNAT / BCRP para la fecha de pago
  const fetchSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || txDate;
    setIsFetchingTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedTc || !exchangeRate || exchangeRate === FALLBACK_USD_PEN_RATE_STR || exchangeRate === '1') {
        setExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT:', err);
    } finally {
      setIsFetchingTc(false);
    }
  };

  // Auto-consulta en tiempo real del tipo de cambio oficial cuando se selecciona USD o cambia la fecha
  useEffect(() => {
    if (isExpenseModalOpen && currency === 'USD') {
      fetchSunatRate(txDate, !hasUserManuallyEditedTc);
    }
  }, [isExpenseModalOpen, currency, txDate]);

  // Consulta de Tipo de Cambio SUNAT para Préstamos (Dinero que presté)
  const fetchLoanSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || loanDate;
    setIsFetchingLoanTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setLoanTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedLoanTc || !loanExchangeRate || loanExchangeRate === FALLBACK_USD_PEN_RATE_STR || loanExchangeRate === '1') {
        setLoanExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedLoanTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT para préstamo:', err);
    } finally {
      setIsFetchingLoanTc(false);
    }
  };

  useEffect(() => {
    if (isReceivableModalOpen && loanCurrency === 'USD') {
      fetchLoanSunatRate(loanDate, !hasUserManuallyEditedLoanTc);
    }
  }, [isReceivableModalOpen, loanCurrency, loanDate]);

  // Consulta de Tipo de Cambio SUNAT para Deudas (Dinero que me prestaron)
  const fetchPayableSunatRate = async (dateForTc?: string, forceOverwrite = false) => {
    const targetDate = dateForTc || payableIssueDate;
    setIsFetchingPayableTc(true);
    try {
      const info = await ExchangeRateService.getRateForDate(targetDate);
      setPayableTcInfo(info);
      if (forceOverwrite || !hasUserManuallyEditedPayableTc || !payableExchangeRate || payableExchangeRate === FALLBACK_USD_PEN_RATE_STR || payableExchangeRate === '1') {
        setPayableExchangeRate(info.rate.toFixed(4));
        if (forceOverwrite) setHasUserManuallyEditedPayableTc(false);
      }
    } catch (err) {
      console.warn('Error al obtener tipo de cambio SUNAT para deuda:', err);
    } finally {
      setIsFetchingPayableTc(false);
    }
  };

  useEffect(() => {
    if (isPayableModalOpen && payableCurrency === 'USD') {
      fetchPayableSunatRate(payableIssueDate, !hasUserManuallyEditedPayableTc);
    }
  }, [isPayableModalOpen, payableCurrency, payableIssueDate]);

  // Handlers para Edición y Nuevas Acciones
  const handleOpenCreateTransaction = () => {
    setEditingTransactionId(null);
    setDesc('');
    setAmount('');
    setCurrency('PEN');
    setExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setTcInfo(null);
    setHasUserManuallyEditedTc(false);
    setSelectedCategoryId(categories[0]?.id || 'cat-1');
    setSelectedMethodId(paymentMethods[0]?.id || '');
    if (isCurrentActiveMonth) {
      const d = new Date();
      setTxDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    } else {
      setTxDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`);
    }
    setIsRecurring(false);
    setOverrideDueDate('');
    setIsRefundMode(false);
    setIsInstallment(false);
    setInstallmentsCount('3');
    setHasInterest(false);
    setMonthlyInstallmentAmount('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditTransaction = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setDesc(tx.description);
    setAmount(tx.originalAmount.toString());
    setCurrency(tx.currency);
    setExchangeRate(tx.exchangeRate?.toString() || FALLBACK_USD_PEN_RATE_STR);
    setTcInfo(null);
    setHasUserManuallyEditedTc(true); // Tratar como valor customizado para no sobreescribir involuntariamente
    setSelectedCategoryId(tx.categoryId);
    const resolvedPm = resolvePaymentMethod(tx, paymentMethods);
    setSelectedMethodId(resolvedPm?.id || tx.paymentMethodId || paymentMethods[0]?.id || '');
    setTxDate(tx.date);
    setIsRecurring(!!tx.isFixedSubscription);
    setOverrideDueDate(tx.paymentDueDate || '');
    setIsRefundMode(!!tx.isRefund);
    setIsInstallment(!!tx.isInstallment);
    setInstallmentsCount(tx.totalInstallments ? tx.totalInstallments.toString() : '3');
    setHasInterest(!!tx.hasInterest);
    setMonthlyInstallmentAmount('');
    setIsExpenseModalOpen(true);
  };

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

  const handleOpenCollectModal = (rec: Receivable) => {
    setCollectingDebtorGroup(null);
    setCollectingRec(rec);
    setCollectAmountInput('');
    setIsCollectModalOpen(true);
  };

  const handleOpenGroupCollectModal = (group: { debtorName: string; totalRemaining: number; items: Receivable[] }) => {
    setCollectingDebtorGroup(group);
    setCollectingRec(null);
    setCollectAmountInput('');
    setIsCollectModalOpen(true);
  };

  const handleCascadeCollect = (debtorName: string, amountToCollect: number) => {
    let remainingToApply = amountToCollect;
    const targetGroup = debtorGroups.find(g => g.debtorName.toLowerCase() === debtorName.toLowerCase());
    if (!targetGroup) return;

    // Préstamos con saldo pendiente (ordenados del más antiguo al más reciente)
    const itemsToPay = targetGroup.items.filter(i => i.remainingAmount > 0);
    const updates = new Map<string, { newPaid: number; isDone: boolean }>();

    for (const item of itemsToPay) {
      if (remainingToApply <= 0) break;
      const pay = Math.min(item.remainingAmount, remainingToApply);
      const newPaid = item.paidAmount + pay;
      const newRem = Math.max(0, item.originalAmount - newPaid);
      const isDone = newRem <= 0;

      updates.set(item.id, { newPaid, isDone });
      // Guardar en Supabase
      SupabaseDataService.recordReceivablePayment(item.id, newPaid, isDone);
      remainingToApply -= pay;
    }

    // Actualizar estado local
    setReceivables(prev =>
      prev.map(r => {
        if (updates.has(r.id)) {
          const upd = updates.get(r.id)!;
          return {
            ...r,
            paidAmount: upd.newPaid,
            remainingAmount: Math.max(0, r.originalAmount - upd.newPaid),
            status: upd.isDone ? 'paid' : 'partial'
          };
        }
        return r;
      })
    );
  };

  const handleSaveCollect = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(collectAmountInput);
    if (isNaN(num) || num <= 0) return;

    if (collectingDebtorGroup) {
      handleCascadeCollect(collectingDebtorGroup.debtorName, num);
      setIsCollectModalOpen(false);
      setCollectingDebtorGroup(null);
      return;
    }

    if (collectingRec) {
      handleCollectReceivable(collectingRec.id, num);
      setIsCollectModalOpen(false);
      setCollectingRec(null);
    }
  };

  const handleOpenAddLoanForDebtor = (name: string) => {
    setDebtorName(name);
    setLoanDesc('');
    setLoanAmount('');
    setLoanCurrency('PEN');
    setLoanExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setLoanTcInfo(null);
    setHasUserManuallyEditedLoanTc(false);
    const d = new Date();
    setLoanDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    setIsReceivableModalOpen(true);
  };

  const toggleDebtorExpanded = (key: string) => {
    setExpandedDebtors(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleScanReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningReceipt(true);
    setScanReceiptError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.includes(',') ? res.split(',')[1] : res;
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageBase64 = await base64Promise;

      const res = await fetch('/api/ai/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type || 'image/jpeg'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'No se pudo escanear el comprobante');
      }

      const data = await res.json();
      if (data.success && data.data) {
        const item = data.data;
        if (item.merchant) {
          setDesc(item.merchant);
        }
        if (typeof item.amount === 'number' && item.amount > 0) {
          setAmount(item.amount.toString());
        }
        if (item.currency === 'USD' || item.currency === 'PEN') {
          setCurrency(item.currency);
          if (item.currency === 'USD') {
            fetchSunatRate(item.date || txDate, true);
          }
        }
        if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
          setTxDate(item.date);
          if (item.currency === 'USD' || currency === 'USD') {
            fetchSunatRate(item.date, true);
          }
        }
        if (item.suggestedCategory) {
          const matched = categories.find(c =>
            c.name.toLowerCase().includes(item.suggestedCategory.toLowerCase()) ||
            item.suggestedCategory.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matched) {
            setSelectedCategoryId(matched.id);
            setAiSuggestion({
              categoryId: matched.id,
              categoryName: matched.name,
              confidence: 0.95,
              isFixedSuggestion: false
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('Error al escanear comprobante:', err);
      setScanReceiptError(err.message || 'Error al procesar el comprobante con Gemini IA');
    } finally {
      setIsScanningReceipt(false);
      e.target.value = '';
    }
  };

  const handleParseNaturalExpense = async (naturalText: string) => {
    if (!naturalText || !naturalText.trim()) return;
    setIsParsingNaturalExpense(true);
    setNaturalExpenseError(null);
    setIsExpenseModalOpen(true);

    try {
      const res = await fetch('/api/ai/parse-natural-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: naturalText.trim(),
          currentDate: currentDateStr,
          availableCategories: categories.map(c => c.name),
          availablePaymentMethods: paymentMethods.map(pm => ({ id: pm.id, name: pm.name, type: pm.type }))
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo interpretar el gasto con IA');
      }

      const data = json.data;
      setEditingTransactionId(null);
      if (data.description) setDesc(data.description);
      if (data.amount !== undefined) setAmount(data.amount.toString());
      if (data.currency === 'USD' || data.currency === 'PEN') {
        setCurrency(data.currency);
        if (data.currency === 'USD') {
          fetchSunatRate(data.date || currentDateStr, true);
        }
      }
      if (data.date) setTxDate(data.date);
      setIsRecurring(Boolean(data.isFixed));
      setIsRefundMode(false);
      setIsInstallment(false);

      if (data.category) {
        const matchedCat = categories.find(c =>
          c.name.toLowerCase().includes(data.category.toLowerCase()) ||
          data.category.toLowerCase().includes(c.name.toLowerCase())
        );
        if (matchedCat) setSelectedCategoryId(matchedCat.id);
      }

      if (data.paymentMethodId) {
        const matchedMethod = paymentMethods.find(pm => pm.id === data.paymentMethodId);
        if (matchedMethod) setSelectedMethodId(matchedMethod.id);
      } else if (data.paymentMethodHint) {
        const matchedMethod = paymentMethods.find(pm =>
          pm.name.toLowerCase().includes(data.paymentMethodHint.toLowerCase()) ||
          data.paymentMethodHint.toLowerCase().includes(pm.name.toLowerCase())
        );
        if (matchedMethod) setSelectedMethodId(matchedMethod.id);
      }

      setIsExpenseModalOpen(true);
    } catch (err: any) {
      console.warn('Error al interpretar gasto con lenguaje natural:', err);
      setNaturalExpenseError(err.message || 'Error al procesar con IA');
    } finally {
      setIsParsingNaturalExpense(false);
    }
  };

  // Handlers
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !amount || isSubmittingExpense) return;

    setIsSubmittingExpense(true);

    try {
      const numAmount = parseFloat(amount);
      const numTc = currency === 'USD' ? parseFloat(exchangeRate || '1') : 1;
      const amountPen = currency === 'USD' ? numAmount * numTc : numAmount;

      const method = paymentMethods.find(p => p.id === selectedMethodId);
      const dueDate = overrideDueDate || calculatePaymentDueDate(txDate, method);

      if (editingTransactionId) {
        const currentTx = transactions.find(t => t.id === editingTransactionId);
        let finalNotes = currentTx?.notes || '';
        if (isRefundMode && !finalNotes.includes('[isRefund:true]')) {
          finalNotes = finalNotes ? `${finalNotes} [isRefund:true]` : '[isRefund:true]';
        } else if (!isRefundMode && finalNotes.includes('[isRefund:true]')) {
          finalNotes = finalNotes.replace(/\[isRefund:true\]/g, '').replace(/\[refund\]/g, '').trim();
        }

        const updatedTx: Transaction = {
          id: editingTransactionId,
          date: txDate,
          description: desc,
          categoryId: selectedCategoryId,
          paymentMethodId: selectedMethodId,
          currency,
          originalAmount: numAmount,
          exchangeRate: numTc,
          amountPen,
          paymentDueDate: dueDate,
          isFixedSubscription: isRecurring,
          isRefund: isRefundMode,
          notes: finalNotes || undefined
        };
        setTransactions(prev =>
          deduplicateTransactions(prev.map(t => (t.id === editingTransactionId ? updatedTx : t)))
        );
        // PUT a Supabase en la nube
        SupabaseDataService.updateTransaction(updatedTx);

        setIsExpenseModalOpen(false);
        setEditingTransactionId(null);
        setDesc('');
        setAmount('');
        setIsRecurring(false);
        setIsRefundMode(false);
        setIsInstallment(false);
        setOverrideDueDate('');
        return;
      }

      // Si es compra en cuotas con tarjeta de crédito
      if (isInstallment && method?.type === 'credit' && !isRefundMode) {
        const count = parseInt(installmentsCount, 10) || 3;
        const monthlyOverride = hasInterest && monthlyInstallmentAmount ? parseFloat(monthlyInstallmentAmount) : undefined;
        const generated = generateInstallmentTransactions(
          {
            description: desc,
            categoryId: selectedCategoryId,
            paymentMethodId: selectedMethodId,
            currency,
            date: txDate
          },
          count,
          numAmount,
          numTc,
          method,
          monthlyOverride
        );

        generated.forEach(inst => SupabaseDataService.createTransaction(inst));
        setTransactions(prev => deduplicateTransactions([...generated, ...prev]));
        setIsExpenseModalOpen(false);
        setDesc('');
        setAmount('');
        setIsRecurring(false);
        setIsInstallment(false);
        setIsRefundMode(false);
        setOverrideDueDate('');
        return;
      }

      const finalNotes = isRefundMode ? '[isRefund:true]' : undefined;
      const newTx: Transaction = {
        id: generateUUID(),
        date: txDate,
        description: desc,
        categoryId: selectedCategoryId,
        paymentMethodId: selectedMethodId,
        currency,
        originalAmount: numAmount,
        exchangeRate: numTc,
        amountPen,
        paymentDueDate: dueDate,
        isFixedSubscription: isRecurring,
        isRefund: isRefundMode,
        notes: finalNotes
      };

      const newTxs: Transaction[] = [newTx];

      // Si el usuario marcó 'Gasto fijo recurrente', replicar automáticamente en los meses siguientes de este año
      if (isRecurring) {
        const [y, m, d] = txDate.split('-').map(Number);
        for (let nextM = m + 1; nextM <= 12; nextM++) {
          const daysInNextM = new Date(y, nextM, 0).getDate();
          const nextDay = Math.min(d, daysInNextM);
          const nextDateStr = `${y}-${nextM.toString().padStart(2, '0')}-${nextDay.toString().padStart(2, '0')}`;
          const nextDueDate = calculatePaymentDueDate(nextDateStr, method);
          const recTx: Transaction = {
            ...newTx,
            id: generateUUID(),
            date: nextDateStr,
            paymentDueDate: nextDueDate,
            isFixedSubscription: true
          };
          newTxs.push(recTx);
          // Replicar en Supabase para cada mes futuro
          SupabaseDataService.createTransaction(recTx);
        }
      }

      // POST de la transacción inicial a Supabase en la nube
      SupabaseDataService.createTransaction(newTx);

      // Actualizar estado local deduplicando atómicamente por ID y firma de negocio
      setTransactions(prev => deduplicateTransactions([...newTxs, ...prev]));

      setIsExpenseModalOpen(false);
      setDesc('');
      setAmount('');
      setIsRecurring(false);
      setOverrideDueDate('');
    } catch (err) {
      console.error('Error al registrar gasto:', err);
    } finally {
      setIsSubmittingExpense(false);
    }
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
      setTransactions(prev => prev.filter(t => t.id !== itemToDelete.id));
      SupabaseDataService.deleteTransaction(itemToDelete.id);
    } else if (itemToDelete.type === 'income') {
      setExtraIncomes(prev => ({
        ...prev,
        [monthKey]: (prev[monthKey] || []).filter(i => i.id !== itemToDelete.id)
      }));
      SupabaseDataService.deleteOtherIncome(itemToDelete.id);
    } else if (itemToDelete.type === 'receivable') {
      setReceivables(prev => prev.filter(r => r.id !== itemToDelete.id));
      SupabaseDataService.deleteReceivable(itemToDelete.id);
    }
    setItemToDelete(null);
  };

  const handleDeleteTransaction = (id: string) => {
    const t = transactions.find(tx => tx.id === id);
    if (t) {
      promptDeleteTransaction(t);
    } else {
      setTransactions(prev => prev.filter(tx => tx.id !== id));
      SupabaseDataService.deleteTransaction(id);
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

  const handleAddExtraIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeDesc || !incomeAmount) return;

    const date = incomeDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`;
    const targetMonthKey = date.slice(0, 7);

    const newInc: OtherIncome = {
      id: `oi-${Date.now()}`,
      description: incomeDesc,
      amount: parseFloat(incomeAmount),
      receivedDate: date
    };

    setExtraIncomes(prev => ({
      ...prev,
      [targetMonthKey]: [...(prev[targetMonthKey] || []), newInc]
    }));

    // POST a Supabase en la nube con fecha exacta
    SupabaseDataService.createOtherIncome(newInc, date);

    setIsIncomeModalOpen(false);
    setIncomeDesc('');
    setIncomeAmount('');
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

  const handleOpenCreateCardPayment = () => {
    setEditingCardPaymentId(null);
    setEditingCardPaymentIndex(null);
    const creditCards = paymentMethods.filter(p => p.type === 'credit');
    if (creditCards.length > 0) {
      setPaymentCardId(creditCards[0].id);
    }
    setPaymentAmount('');
    setPaymentSourceType('DEBIT_ACCOUNT');
    const now = new Date();
    const day = (currentYear === now.getFullYear() && currentMonth === (now.getMonth() + 1))
      ? now.getDate().toString().padStart(2, '0')
      : '20';
    setPaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day}`);
    setIsPaymentModalOpen(true);
  };

  const handleOpenEditCardPayment = (pay: CardPayment, idx: number) => {
    setEditingCardPaymentId(pay.id || `cp-${idx}`);
    setEditingCardPaymentIndex(idx);
    setPaymentCardId(pay.paymentMethodId);
    setPaymentAmount(pay.amountPaid.toString());
    setPaymentDate(pay.paymentDate);
    setPaymentSourceType(pay.sourceType || 'DEBIT_ACCOUNT');
    setIsPaymentModalOpen(true);
  };

  const handleMakeCardPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentCardId) return;

    const num = parseFloat(paymentAmount);
    if (isNaN(num) || num <= 0) return;

    const targetDate = paymentDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-20`;

    if (editingCardPaymentIndex !== null || editingCardPaymentId !== null) {
      // Modificar pago existente
      setCardPayments(prev => prev.map((p, idx) => {
        const matches = (editingCardPaymentId && p.id === editingCardPaymentId) ||
          (editingCardPaymentIndex !== null && idx === editingCardPaymentIndex);
        if (matches) {
          return {
            ...p,
            paymentMethodId: paymentCardId,
            amountPaid: num,
            paymentDate: targetDate,
            sourceType: paymentSourceType
          };
        }
        return p;
      }));
      setIsPaymentModalOpen(false);
      setEditingCardPaymentId(null);
      setEditingCardPaymentIndex(null);
      setPaymentAmount('');
      return;
    }

    const newPay: CardPayment = {
      id: `cp-${Date.now()}`,
      paymentMethodId: paymentCardId,
      amountPaid: num,
      paymentDate: targetDate,
      sourceType: paymentSourceType
    };

    setCardPayments([newPay, ...cardPayments]);
    // POST a Supabase en la nube
    SupabaseDataService.createCardPayment(newPay);
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
  };

  // Handlers para Mis Deudas (Payables)
  const handleOpenCreatePayable = () => {
    setPayableCreditorName('');
    setPayableDesc('');
    setPayableAmount('');
    setPayableDueDate('');
    setPayableCurrency('PEN');
    setPayableExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPayableTcInfo(null);
    setHasUserManuallyEditedPayableTc(false);
    const d = new Date();
    setPayableIssueDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    setPayableIsCreditedToDebit(false);
    setIsPayableModalOpen(true);
  };

  const handleCreatePayable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payableCreditorName || !payableAmount) return;
    const num = parseFloat(payableAmount);
    if (isNaN(num) || num <= 0) return;
    const tc = payableCurrency === 'USD' ? (parseFloat(payableExchangeRate) || FALLBACK_USD_PEN_RATE) : 1;
    const totalInPen = payableCurrency === 'USD' ? num * tc : num;

    const newPayable: Payable = {
      id: `pay-${Date.now()}`,
      creditorName: payableCreditorName.trim(),
      description: payableDesc.trim() || 'Préstamo personal',
      totalAmount: num,
      originalAmount: num,
      remainingAmount: num,
      paidAmount: 0,
      currency: payableCurrency,
      exchangeRate: payableCurrency === 'USD' ? tc : undefined,
      amountPen: totalInPen,
      issueDate: payableIssueDate,
      createdAt: payableIssueDate,
      dueDate: payableDueDate || undefined,
      isCreditedToDebit: payableIsCreditedToDebit,
      status: 'PENDING',
      payments: []
    };

    setPayables(prev => [newPayable, ...prev]);
    SupabaseDataService.createPayable(newPayable);

    // Si el usuario indicó abonar a cuenta débito:
    if (payableIsCreditedToDebit) {
      const loanIncomeId = `inc-loan-${Date.now()}`;
      const loanIncomeDesc = `Préstamo recibido: ${payableCreditorName.trim()} ${payableCurrency === 'USD' ? `• $ ${num.toFixed(2)} USD` : ''}`;
      const newIncome: OtherIncome = {
        id: loanIncomeId,
        description: loanIncomeDesc,
        amount: totalInPen,
        receivedDate: payableIssueDate
      };
      setExtraIncomes(prev => ({
        ...prev,
        [monthKey]: [newIncome, ...(prev[monthKey] || [])]
      }));
      SupabaseDataService.createOtherIncome(newIncome, payableIssueDate);
    }

    setIsPayableModalOpen(false);
    setPayableCreditorName('');
    setPayableDesc('');
    setPayableAmount('');
    setPayableDueDate('');
    setPayableCurrency('PEN');
    setPayableExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPayableTcInfo(null);
    setHasUserManuallyEditedPayableTc(false);
    setPayableIsCreditedToDebit(false);
  };

  const handleOpenAddLoanForCreditor = (name: string) => {
    setPayableCreditorName(name);
    setPayableDesc('');
    setPayableAmount('');
    setPayableDueDate('');
    setPayableCurrency('PEN');
    setPayableExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setPayableTcInfo(null);
    setHasUserManuallyEditedPayableTc(false);
    const d = new Date();
    setPayableIssueDate(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`);
    setPayableIsCreditedToDebit(false);
    setIsPayableModalOpen(true);
  };

  const toggleCreditorExpanded = (key: string) => {
    setExpandedCreditors(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleOpenGroupPayModal = (group: CreditorGroup) => {
    setPayingCreditorGroup(group);
    setPayingPayable(null);
    setPayablePaymentAmount('');
    setPayablePaymentNotes('');
    const now = new Date();
    setPayablePaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`);
    setIsPayablePaymentModalOpen(true);
  };

  const handleCascadePay = (creditorName: string, amountToPay: number, payDate?: string, payNotes?: string) => {
    let remainingToApply = amountToPay;
    const targetGroup = creditorGroups.find(g => g.creditorName.toLowerCase() === creditorName.toLowerCase());
    if (!targetGroup) return;

    const itemsToPay = targetGroup.items.filter(i => (i.remainingAmount ?? (i.totalAmount ?? i.originalAmount)) > 0);
    const dateStr = payDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
    const updates = new Map<string, { newPaid: number; newRem: number; isDone: boolean; paymentRecord: PayablePayment }>();

    for (const item of itemsToPay) {
      if (remainingToApply <= 0) break;
      const itemTotal = item.totalAmount ?? item.originalAmount ?? 0;
      const curRem = item.remainingAmount ?? itemTotal;
      const pay = Math.min(curRem, remainingToApply);
      const newPaid = (item.paidAmount ?? 0) + pay;
      const newRem = Math.max(0, itemTotal - newPaid);
      const isDone = newRem <= 0;

      const pRecord: PayablePayment = {
        id: `ppay-${Date.now()}-${item.id}`,
        payableId: item.id,
        amountPaid: pay,
        amount: pay,
        paymentDate: dateStr,
        paymentMethodId: 'pm-1',
        notes: payNotes || 'Abono en cascada a acreedor'
      };

      updates.set(item.id, { newPaid, newRem, isDone, paymentRecord: pRecord });
      remainingToApply -= pay;
    }

    setPayables(prev =>
      prev.map(p => {
        if (updates.has(p.id)) {
          const upd = updates.get(p.id)!;
          return {
            ...p,
            paidAmount: upd.newPaid,
            remainingAmount: upd.newRem,
            status: upd.isDone ? 'PAID' : 'PARTIALLY_PAID',
            payments: [...(p.payments || []), upd.paymentRecord]
          };
        }
        return p;
      })
    );

    updates.forEach((upd, payableId) => {
      SupabaseDataService.recordPayablePayment(payableId, upd.paymentRecord, upd.newPaid, upd.isDone);
    });
  };

  const handleOpenPayPayable = (payable: Payable) => {
    setPayingCreditorGroup(null);
    setPayingPayable(payable);
    setPayablePaymentAmount('');
    setPayablePaymentNotes('');
    const now = new Date();
    setPayablePaymentDate(`${currentYear}-${currentMonth.toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`);
    setIsPayablePaymentModalOpen(true);
  };

  const handlePayPayable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payablePaymentAmount) return;
    const num = parseFloat(payablePaymentAmount);
    if (isNaN(num) || num <= 0) return;

    if (payingCreditorGroup) {
      handleCascadePay(payingCreditorGroup.creditorName, num, payablePaymentDate, payablePaymentNotes);
      setIsPayablePaymentModalOpen(false);
      setPayingCreditorGroup(null);
      setPayablePaymentAmount('');
      setPayablePaymentNotes('');
      return;
    }

    if (payingPayable) {
      const payRecord: PayablePayment = {
        id: `ppay-${Date.now()}`,
        payableId: payingPayable.id,
        amountPaid: num,
        amount: num,
        paymentDate: payablePaymentDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`,
        paymentMethodId: 'pm-1',
        notes: payablePaymentNotes || undefined
      };

      const payTotal = payingPayable.totalAmount ?? payingPayable.originalAmount ?? 0;
      const payNewPaid = payingPayable.paidAmount + num;
      const payIsDone = Math.max(0, payTotal - payNewPaid) === 0;

      setPayables(prev => prev.map(p => {
        if (p.id === payingPayable.id) {
          return {
            ...p,
            paidAmount: payNewPaid,
            remainingAmount: Math.max(0, payTotal - payNewPaid),
            status: payIsDone ? 'PAID' : 'PARTIALLY_PAID',
            payments: [...(p.payments || []), payRecord]
          };
        }
        return p;
      }));

      SupabaseDataService.recordPayablePayment(payingPayable.id, payRecord, payNewPaid, payIsDone);

      setIsPayablePaymentModalOpen(false);
      setPayingPayable(null);
      setPayablePaymentAmount('');
      setPayablePaymentNotes('');
    }
  };

  const handleDeletePayable = (payableId: string) => {
    setPayables(prev => prev.filter(p => p.id !== payableId));
    SupabaseDataService.deletePayable(payableId);
  };

  const handleDeleteCardPayment = (targetId?: string, targetIndex?: number) => {
    setCardPayments(prev => prev.filter((p, idx) => {
      if (targetId && p.id && p.id === targetId) return false;
      if (targetId && !p.id && `cp-${idx}` === targetId) return false;
      if (!targetId && targetIndex !== undefined && idx === targetIndex) return false;
      return true;
    }));
    if (targetId && !targetId.startsWith('cp-saved-') && !targetId.startsWith('cp-legacy-') && !targetId.startsWith('cp-tx-')) {
      SupabaseDataService.deleteCardPayment(targetId);
    }
  };

  const handleCreateReceivable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName || !loanAmount) return;

    const orig = parseFloat(loanAmount);
    if (isNaN(orig) || orig <= 0) return;
    const tc = loanCurrency === 'USD' ? (parseFloat(loanExchangeRate) || FALLBACK_USD_PEN_RATE) : 1;
    const amountPen = loanCurrency === 'USD' ? orig * tc : orig;

    const newRec: Receivable = {
      id: `rec-${Date.now()}`,
      debtorName: debtorName.trim(),
      description: loanDesc.trim() || 'Préstamo',
      originalAmount: orig,
      paidAmount: 0,
      remainingAmount: orig,
      currency: loanCurrency,
      exchangeRate: loanCurrency === 'USD' ? tc : undefined,
      amountPen: amountPen,
      loanDate: loanDate,
      status: 'pending',
      createdAt: loanDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`
    };

    setReceivables([newRec, ...receivables]);
    // POST a Supabase en la nube
    SupabaseDataService.createReceivable(newRec);
    setIsReceivableModalOpen(false);
    setDebtorName('');
    setLoanDesc('');
    setLoanAmount('');
    setLoanCurrency('PEN');
    setLoanExchangeRate(FALLBACK_USD_PEN_RATE_STR);
    setLoanTcInfo(null);
    setHasUserManuallyEditedLoanTc(false);
  };

  const handleCollectReceivable = (id: string, amountToCollect: number) => {
    setReceivables(prev =>
      prev.map(r => {
        if (r.id === id) {
          const newPaid = r.paidAmount + amountToCollect;
          const newRemaining = Math.max(0, r.originalAmount - newPaid);
          const isDone = newRemaining === 0;
          // PUT a Supabase en la nube
          SupabaseDataService.recordReceivablePayment(id, newPaid, isDone);
          return {
            ...r,
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: isDone ? 'paid' : 'partial'
          };
        }
        return r;
      })
    );
  };

  // Carga y Parseo de Estado de Cuenta Real (.xlsx, .xls, .csv, .pdf)
  const handleStatementFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingStatement(true);
    setStatementFileName(file.name);
    try {
      const parsed = await ReconciliationService.parseFile(file);
      const summary = ReconciliationService.reconcile(parsed, currentMonthTransactions, categories);
      setReconciliationSummary(summary);
    } catch (err) {
      console.error('Error al procesar archivo bancario:', err);
      alert('No se pudo leer el archivo bancario. Asegúrate de que sea un archivo Excel (.xlsx, .xls) o CSV válido.');
    } finally {
      setIsParsingStatement(false);
    }
  };

  // Carga de Estado de Cuenta Demo (BCP / Interbank) para prueba inmediata
  const handleLoadDemoStatement = () => {
    setIsParsingStatement(true);
    setStatementFileName('Estado_Cuenta_BCP_Demostracion.xlsx');

    const demoStatement: StatementTransaction[] = [
      { id: 'stmt-demo-1', date: `${monthKey}-05`, description: 'SUPERMERCADOS WONG MIRAFLORES', amount: 142.50, type: 'debit' },
      { id: 'stmt-demo-2', date: `${monthKey}-08`, description: 'NETFLIX MENSUALIDAD', amount: 44.90, type: 'debit' },
      { id: 'stmt-demo-3', date: `${monthKey}-12`, description: 'UBER TRIP LIMA PE', amount: 24.50, type: 'debit' },
      { id: 'stmt-demo-4', date: `${monthKey}-14`, description: 'STARBUCKS JAVIER PRADO', amount: 19.00, type: 'debit' },
      { id: 'stmt-demo-5', date: `${monthKey}-18`, description: 'FARMACIAS INKAFARMA', amount: 38.00, type: 'debit' },
      { id: 'stmt-demo-6', date: `${monthKey}-22`, description: 'RAPPI PERU SAC', amount: 56.50, type: 'debit' }
    ];

    setTimeout(() => {
      const summary = ReconciliationService.reconcile(demoStatement, currentMonthTransactions, categories);
      setReconciliationSummary(summary);
      setIsParsingStatement(false);
    }, 400);
  };

  // Importar gasto faltante con 1 Clic desde el Estado de Cuenta
  const handleImportStatementItem = (item: ReconciliationItem) => {
    if (!item.statementTx) return;
    const st = item.statementTx;

    const predicted = AIIntelligenceService.predictCategory(st.description, categories);
    const catId = predicted?.categoryId || categories[11]?.id || categories[0]?.id;
    const debitMethod = paymentMethods.find(p => p.type === 'debit') || paymentMethods[0];
    const dueDate = calculatePaymentDueDate(st.date, debitMethod);

    const newTx: Transaction = {
      id: generateUUID(),
      date: st.date,
      description: st.description,
      categoryId: catId,
      paymentMethodId: debitMethod.id,
      currency: 'PEN',
      originalAmount: st.amount,
      exchangeRate: 1,
      amountPen: st.amount,
      paymentDueDate: dueDate,
      isFixedSubscription: predicted?.isFixedSuggestion || false,
      notes: 'Conciliado e importado automáticamente desde Estado de Cuenta bancario'
    };

    setTransactions(prev => deduplicateTransactions([newTx, ...prev]));
    SupabaseDataService.createTransaction(newTx);

    // Actualizar resumen de conciliación
    if (reconciliationSummary) {
      setReconciliationSummary(prev => {
        if (!prev) return null;
        const updatedItems = prev.items.map(it => {
          if (it.id === item.id) {
            return {
              ...it,
              status: 'matched' as const,
              appTx: newTx,
              confidence: 1.0,
              notes: 'Importado y conciliado exitosamente en FinTrack.'
            };
          }
          return it;
        });

        const newMatched = updatedItems.filter(i => i.status === 'matched').length;
        const newUnmatched = updatedItems.filter(i => i.status === 'unmatched_in_app').length;
        const total = prev.items.filter(i => i.statementTx).length || 1;

        return {
          ...prev,
          matchedCount: newMatched,
          unmatchedInAppCount: newUnmatched,
          matchPercentage: Math.round((newMatched / total) * 100),
          items: updatedItems
        };
      });
    }
  };

  
  // Importar todos los consumos faltantes en bloque con 1 Clic
  const handleImportAllUnmatched = () => {
    if (!reconciliationSummary) return;
    const unmatchedItems = reconciliationSummary.items.filter(
      it => it.status === 'unmatched_in_app' && it.statementTx
    );
    if (unmatchedItems.length === 0) return;

    const newTxs: Transaction[] = [];
    const debitMethod = paymentMethods.find(p => p.type === 'debit') || paymentMethods[0];

    unmatchedItems.forEach(item => {
      const st = item.statementTx!;
      const predicted = AIIntelligenceService.predictCategory(st.description, categories);
      const catId = predicted?.categoryId || categories[11]?.id || categories[0]?.id;
      const dueDate = calculatePaymentDueDate(st.date, debitMethod);

      const newTx: Transaction = {
        id: generateUUID(),
        date: st.date,
        description: st.description,
        categoryId: catId,
        paymentMethodId: debitMethod.id,
        currency: 'PEN',
        originalAmount: st.amount,
        exchangeRate: 1,
        amountPen: st.amount,
        paymentDueDate: dueDate,
        isFixedSubscription: predicted?.isFixedSuggestion || false,
        notes: 'Conciliado e importado automáticamente desde Estado de Cuenta bancario'
      };
      newTxs.push(newTx);
      SupabaseDataService.createTransaction(newTx);
    });

    setTransactions(prev => deduplicateTransactions([...newTxs, ...prev]));

    setReconciliationSummary(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map(it => {
        const created = newTxs.find(tx => tx.description === it.statementTx?.description && tx.amountPen === it.statementTx?.amount);
        if (it.status === 'unmatched_in_app' && created) {
          return {
            ...it,
            status: 'matched' as const,
            appTx: created,
            confidence: 1.0,
            notes: 'Importado y conciliado exitosamente en FinTrack.'
          };
        }
        return it;
      });

      const newMatched = updatedItems.filter(i => i.status === 'matched').length;
      const newUnmatched = updatedItems.filter(i => i.status === 'unmatched_in_app').length;
      const total = prev.items.filter(i => i.statementTx).length || 1;

      return {
        ...prev,
        matchedCount: newMatched,
        unmatchedInAppCount: newUnmatched,
        matchPercentage: Math.round((newMatched / total) * 100),
        items: updatedItems
      };
    });
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
          onClose={() => {
            setIsPaymentModalOpen(false);
            setEditingCardPaymentId(null);
            setEditingCardPaymentIndex(null);
            setPaymentAmount('');
          }}
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
          onSubmit={e => {
            e.preventDefault();
            if (!salaryAmount) return;
            const amt = parseFloat(salaryAmount);
            const pDay = parseInt(salaryPayDay, 10) || 30;

            setSalaries([
              {
                id: 'sal-1',
                source: salarySource || 'Empleo Principal',
                amount: amt,
                payDay: pDay
              }
            ]);
            // Sincronizar sueldo base en Supabase
            SupabaseDataService.updateBaseSalary(currentYear, currentMonth, amt);
            setIsSalaryModalOpen(false);
          }}
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
