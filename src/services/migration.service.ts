'use client';

/**
 * One-time recovery: push data that used to live only in localStorage
 * (before Supabase became the single source of truth) up to Supabase.
 * Idempotent and dedup-aware, so it is safe to run more than once.
 * Runs in the browser under the signed-in user (RLS applies).
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SupabaseDataService } from './supabaseData.service';
import { Transaction, PaymentMethod, Receivable, Payable, Category, OtherIncome, SalaryIncome } from '@/types';

interface LegacyCardPayment {
  id?: string;
  paymentMethodId: string;
  amountPaid: number;
  paymentDate: string;
  sourceType?: 'DEBIT_ACCOUNT' | 'MERCHANT_REFUND' | 'BANK_CREDIT';
}

interface LegacyData {
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  transactions?: Transaction[];
  receivables?: Receivable[];
  payables?: Payable[];
  cardPayments?: LegacyCardPayment[];
  salaries?: SalaryIncome[];
  extraIncomes?: Record<string, OtherIncome[]>;
  initialDebitBalances?: Record<string, number>;
}

export interface MigrationReport {
  dryRun: boolean;
  found: boolean;
  categories: { create: number; existing: number };
  paymentMethods: { create: number; existing: number };
  transactions: { create: number; skip: number };
  payables: { create: number; skip: number; payments: number };
  receivables: { create: number; skip: number };
  cardPayments: { create: number; skip: number };
  otherIncomes: { create: number; skip: number };
  periods: { balances: number };
  errors: string[];
}

const norm = (s?: string) => (s || '').trim().toLowerCase();
const money = (n?: number) => (n || 0).toFixed(2);
const legacyKey = (username: string) => `fintrack_data_${username.toLowerCase()}`;

export async function migrateLegacyData(username: string, dryRun = true): Promise<MigrationReport> {
  const report: MigrationReport = {
    dryRun,
    found: false,
    categories: { create: 0, existing: 0 },
    paymentMethods: { create: 0, existing: 0 },
    transactions: { create: 0, skip: 0 },
    payables: { create: 0, skip: 0, payments: 0 },
    receivables: { create: 0, skip: 0 },
    cardPayments: { create: 0, skip: 0 },
    otherIncomes: { create: 0, skip: 0 },
    periods: { balances: 0 },
    errors: []
  };

  if (!isSupabaseConfigured || !supabase) {
    report.errors.push('Supabase no está configurado.');
    return report;
  }
  if (typeof window === 'undefined') {
    report.errors.push('La migración solo corre en el navegador.');
    return report;
  }

  let data: LegacyData | null = null;
  try {
    const raw = localStorage.getItem(legacyKey(username));
    if (raw) data = JSON.parse(raw);
  } catch {
    report.errors.push('No se pudo leer localStorage.');
    return report;
  }
  if (!data) return report;
  report.found = true;

  // --- Categories: create missing, map legacy id -> cloud id by name ---
  const cloudCats = (await SupabaseDataService.getCategories()) || [];
  const cloudCatNames = new Set(cloudCats.map(c => norm(c.name)));
  for (const c of data.categories || []) {
    if (cloudCatNames.has(norm(c.name))) report.categories.existing++;
    else {
      report.categories.create++;
      if (!dryRun && !(await SupabaseDataService.createCategory(c))) report.errors.push(`categoría: ${c.name}`);
    }
  }
  const cats2 = dryRun ? cloudCats : (await SupabaseDataService.getCategories()) || cloudCats;
  const catNameToId = new Map(cats2.map(c => [norm(c.name), c.id]));
  const catMap = new Map<string, string>();
  for (const c of data.categories || []) {
    const id = catNameToId.get(norm(c.name));
    if (id) catMap.set(c.id, id);
  }

  // --- Payment methods: create missing, map legacy id -> cloud id by name ---
  const cloudPms = (await SupabaseDataService.getPaymentMethods()) || [];
  const cloudPmNames = new Set(cloudPms.map(p => norm(p.name)));
  for (const m of data.paymentMethods || []) {
    if (cloudPmNames.has(norm(m.name))) report.paymentMethods.existing++;
    else {
      report.paymentMethods.create++;
      if (!dryRun && !(await SupabaseDataService.createPaymentMethod(m))) report.errors.push(`método de pago: ${m.name}`);
    }
  }
  const pms2 = dryRun ? cloudPms : (await SupabaseDataService.getPaymentMethods()) || cloudPms;
  const pmNameToId = new Map(pms2.map(p => [norm(p.name), p.id]));
  const pmMap = new Map<string, string>();
  for (const m of data.paymentMethods || []) {
    const id = pmNameToId.get(norm(m.name));
    if (id) pmMap.set(m.id, id);
  }
  const remapPm = (id?: string) => (id && pmMap.get(id)) || id || '';
  const remapCat = (id?: string) => (id && catMap.get(id)) || id || '';

  // --- Transactions: dedup by date + description + amount ---
  const txMonths = Array.from(new Set((data.transactions || []).map(t => (t.date || '').slice(0, 7)).filter(Boolean)));
  const cloudTxSig = new Set<string>();
  for (const mk of txMonths) {
    const cloud = (await SupabaseDataService.getTransactions(mk)) || [];
    cloud.forEach(t => cloudTxSig.add(`${t.date}|${norm(t.description)}|${money(t.amountPen)}`));
  }
  for (const t of data.transactions || []) {
    const sig = `${t.date}|${norm(t.description)}|${money(t.amountPen)}`;
    if (cloudTxSig.has(sig)) { report.transactions.skip++; continue; }
    report.transactions.create++;
    if (!dryRun) {
      const ok = await SupabaseDataService.createTransaction({ ...t, paymentMethodId: remapPm(t.paymentMethodId), categoryId: remapCat(t.categoryId) });
      if (ok) cloudTxSig.add(sig);
      else report.errors.push(`movimiento: ${t.date} ${t.description}`);
    }
  }

  // Re-link cloud transactions that still point at a legacy method id
  // (e.g. from an earlier partial run before the cards were created).
  if (!dryRun && pmMap.size) {
    for (const mk of txMonths) {
      const cloud = (await SupabaseDataService.getTransactions(mk)) || [];
      for (const t of cloud) {
        const mapped = t.paymentMethodId ? pmMap.get(t.paymentMethodId) : undefined;
        if (mapped && mapped !== t.paymentMethodId) {
          await SupabaseDataService.updateTransaction({ ...t, paymentMethodId: mapped });
        }
      }
    }
  }

  // --- Payables: dedup by creditor + amount + issue date; then their payments ---
  const payableSig = (p: Payable) => `${norm(p.creditorName)}|${money(p.originalAmount || p.totalAmount)}|${p.issueDate || ''}`;
  const cloudPayables = (await SupabaseDataService.getPayables()) || [];
  const cloudPayableSigs = new Set(cloudPayables.map(payableSig));
  const createdPayables: Payable[] = [];
  for (const p of data.payables || []) {
    if (cloudPayableSigs.has(payableSig(p))) { report.payables.skip++; continue; }
    report.payables.create++;
    report.payables.payments += (p.payments || []).length;
    createdPayables.push(p);
    if (!dryRun && !(await SupabaseDataService.createPayable(p))) report.errors.push(`deuda: ${p.creditorName}`);
  }
  if (!dryRun && createdPayables.length) {
    const after = (await SupabaseDataService.getPayables()) || [];
    const sigToId = new Map(after.map(p => [payableSig(p), p.id]));
    for (const p of createdPayables) {
      const cloudId = sigToId.get(payableSig(p));
      if (!cloudId || !(p.payments || []).length) continue;
      const total = p.originalAmount || p.totalAmount || 0;
      let running = 0;
      for (const pay of p.payments!) {
        running += pay.amount || pay.amountPaid || 0;
        await SupabaseDataService.recordPayablePayment(cloudId, { ...pay, payableId: cloudId }, running, running >= total - 0.01);
      }
    }
  }

  // --- Receivables: dedup by debtor + amount + date; then partial payment ---
  const recSig = (r: Receivable) => `${norm(r.debtorName)}|${money(r.originalAmount)}|${r.createdAt || r.loanDate || ''}`;
  const cloudRecs = (await SupabaseDataService.getReceivables()) || [];
  const cloudRecSigs = new Set(cloudRecs.map(recSig));
  const createdRecs: Receivable[] = [];
  for (const r of data.receivables || []) {
    if (cloudRecSigs.has(recSig(r))) { report.receivables.skip++; continue; }
    report.receivables.create++;
    createdRecs.push(r);
    if (!dryRun && !(await SupabaseDataService.createReceivable(r))) report.errors.push(`cuenta por cobrar: ${r.debtorName}`);
  }
  if (!dryRun && createdRecs.length) {
    const after = (await SupabaseDataService.getReceivables()) || [];
    const sigToRec = new Map(after.map(r => [recSig(r), r]));
    for (const r of createdRecs) {
      if (!r.paidAmount || r.paidAmount <= 0) continue;
      const cloud = sigToRec.get(recSig(r));
      if (cloud) await SupabaseDataService.recordReceivablePayment(cloud.id, r.paidAmount, (r.remainingAmount ?? (r.originalAmount - r.paidAmount)) <= 0.01);
    }
  }

  // --- Card payments: dedup by method + amount + date ---
  const cpMonths = Array.from(new Set((data.cardPayments || []).map(cp => (cp.paymentDate || '').slice(0, 7)).filter(Boolean)));
  const cloudCpSig = new Set<string>();
  for (const mk of cpMonths) {
    const cloud = (await SupabaseDataService.getCardPayments(mk)) || [];
    cloud.forEach(cp => cloudCpSig.add(`${cp.paymentMethodId}|${money(cp.amountPaid)}|${cp.paymentDate}`));
  }
  for (const cp of data.cardPayments || []) {
    const pm = remapPm(cp.paymentMethodId);
    if (cloudCpSig.has(`${pm}|${money(cp.amountPaid)}|${cp.paymentDate}`) || cloudCpSig.has(`${cp.paymentMethodId}|${money(cp.amountPaid)}|${cp.paymentDate}`)) {
      report.cardPayments.skip++;
      continue;
    }
    report.cardPayments.create++;
    if (!dryRun) {
      await SupabaseDataService.createCardPayment({ ...cp, paymentMethodId: pm });
      cloudCpSig.add(`${pm}|${money(cp.amountPaid)}|${cp.paymentDate}`);
    }
  }

  // --- Other incomes: dedup by description + amount + date ---
  const incMonths = Object.keys(data.extraIncomes || {});
  const cloudIncSig = new Set<string>();
  for (const mk of incMonths) {
    const cloud = (await SupabaseDataService.getOtherIncomes(mk)) || [];
    cloud.forEach(oi => cloudIncSig.add(`${norm(oi.description)}|${money(oi.amount)}|${oi.receivedDate}`));
  }
  for (const mk of incMonths) {
    for (const oi of data.extraIncomes![mk] || []) {
      const sig = `${norm(oi.description)}|${money(oi.amount)}|${oi.receivedDate}`;
      if (cloudIncSig.has(sig)) { report.otherIncomes.skip++; continue; }
      report.otherIncomes.create++;
      if (!dryRun) {
        await SupabaseDataService.createOtherIncome(oi, oi.receivedDate);
        cloudIncSig.add(sig);
      }
    }
  }

  // --- Initial debit balances and base salary per month ---
  const baseSalary = data.salaries?.[0]?.amount || 0;
  for (const [mk, bal] of Object.entries(data.initialDebitBalances || {})) {
    const [y, m] = mk.split('-').map(Number);
    if (!y || !m) continue;
    report.periods.balances++;
    if (!dryRun) {
      await SupabaseDataService.updateInitialDebitBalance(y, m, bal);
      if (baseSalary > 0) await SupabaseDataService.updateBaseSalary(y, m, baseSalary);
    }
  }

  if (!dryRun) {
    try { localStorage.setItem(`fintrack_migrated_v1_${username.toLowerCase()}`, new Date().toISOString()); } catch {}
  }

  console.log(`[FinTrack] Migración ${dryRun ? 'SIMULADA (nada se escribió)' : 'APLICADA'}:`, report);
  return report;
}
