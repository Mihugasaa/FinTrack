'use client';

import React, { useState } from 'react';
import { FALLBACK_USD_PEN_RATE } from '@/lib/constants';
import { getFallbackReceivablePaymentDate } from '@/lib/calculations';
import { useFinance } from '@/contexts/FinanceContext';
import {
  Search,
  Layers,
  TrendingDown,
  Repeat,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  Banknote,
  Tag,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';

export const TransactionsTab: React.FC = () => {
  const {
    combinedMovements,
    monthMovementsTotal,
    diagnostic,
    searchQuery,
    setSearchQuery,
    txTypeFilter,
    setTxTypeFilter,
    currentMonthTransactions,
    currentMonthCardPayments,
    salaries,
    currentOtherIncomes,
    payables,
    receivables,
    navigateToDebtor,
    navigateToPayableCreditor,
    monthKey,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    paymentMethods,
    selectedCategory,
    setSelectedCategory,
    categories,
    handleOpenCreateCardPayment,
    monthNames,
    currentMonth,
    currentYear,
    isCurrentMonthViewed,
    todayDividerIndex,
    renderTodayDividerRow,
    renderTodayDividerMobile,
    handleOpenEditCardPayment,
    handleDeleteCardPayment,
    resolvePaymentMethod,
    handleOpenEditTransaction,
    promptDeleteTransaction,
    formatDisplayDate,
    formatSoles,
    currentDateStr,
    handleParseNaturalExpense,
    isParsingNaturalExpense,
    handleOpenEditCollectPayment
  } = useFinance();

  const currentMonthReceivablePaymentsCount = React.useMemo(() => {
    return receivables.reduce((acc, r) => {
      const eff = (r.payments && r.payments.length > 0)
        ? r.payments
        : (r.paidAmount > 0 ? [{ paymentDate: getFallbackReceivablePaymentDate(r, monthKey, currentDateStr) }] : []);
      return acc + eff.filter(pay => pay.paymentDate.startsWith(monthKey)).length;
    }, 0);
  }, [receivables, monthKey, currentDateStr]);
  const [naturalText, setNaturalText] = useState('');
  const isItemFuture = (sortDate: string) => {
    if (isCurrentMonthViewed) {
      return sortDate > currentDateStr;
    }
    const now = new Date();
    const isFutureViewed = currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth > (now.getMonth() + 1));
    return isFutureViewed;
  };

  const formatShortDate = (d?: string) => {
    if (!d) return '';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTxTypeFilter('ALL');
    setSelectedPaymentMethod('ALL');
    setSelectedCategory('ALL');
  };

  const isAnyFilterActive = Boolean(
    searchQuery.trim() ||
    txTypeFilter !== 'ALL' ||
    selectedPaymentMethod !== 'ALL' ||
    selectedCategory !== 'ALL'
  );

  return (
    <section className="transactions-panel clean-card">
      <div className="panel-header-row">
        <div className="panel-header-title-group">
          <span className="panel-title">Listado de Movimientos</span>
          <span className="badge badge-neutral">
            {isAnyFilterActive
              ? `${combinedMovements.length} de ${monthMovementsTotal} movimientos`
              : `${monthMovementsTotal} movimientos`}
          </span>
          <span
            className="movements-gasto-hint"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
            title="Suma de gastos consumidos este mes (neto de reembolsos). No incluye ingresos ni pagos a tarjeta."
          >
            <span aria-hidden className="movements-gasto-sep" style={{ color: 'var(--border-medium)' }}>|</span>
            Gasto del mes: <strong className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{formatSoles(diagnostic.totalExpensesConsumed)}</strong>
          </span>
        </div>
      </div>

      {/* Barra de Registro Rápido por Lenguaje Natural con Gemini IA */}
      <div
        className="natural-expense-bar"
        style={{
          margin: '0 0 16px 0',
          padding: '10px 14px',
          background: 'var(--accent-brand-subtle)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-brand)', fontWeight: 600, fontSize: '0.82rem' }}>
          <Sparkles size={16} />
          <span className="desktop-only">Registro Rápido con IA:</span>
        </div>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            id="input-natural-expense"
            type="text"
            placeholder="Ej: 'Cena chifa 45 soles ayer tarjeta bcp' o 'Uber 18 soles hoy'..."
            value={naturalText}
            onChange={e => setNaturalText(e.target.value)}
            onKeyDown={async e => {
              if (e.key === 'Enter' && naturalText.trim() && !isParsingNaturalExpense && handleParseNaturalExpense) {
                const txt = naturalText;
                setNaturalText('');
                await handleParseNaturalExpense(txt);
              }
            }}
            disabled={isParsingNaturalExpense}
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '7px 12px',
              fontSize: '0.82rem',
              color: 'var(--text-primary)'
            }}
          />
        </div>
        <button
          id="btn-submit-natural-expense"
          type="button"
          className="btn-primary"
          onClick={async () => {
            if (naturalText.trim() && !isParsingNaturalExpense && handleParseNaturalExpense) {
              const txt = naturalText;
              setNaturalText('');
              await handleParseNaturalExpense(txt);
            }
          }}
          disabled={isParsingNaturalExpense || !naturalText.trim()}
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            background: 'var(--accent-brand)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: isParsingNaturalExpense ? 'wait' : 'pointer'
          }}
        >
          {isParsingNaturalExpense ? (
            <>
              <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
              <span>Interpretando...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Registrar con IA</span>
            </>
          )}
        </button>
      </div>

      {/* Barra Omni-Filter Unificada (Línea Continua sin Ctrl K, Reset Icon-Only) */}
      <div className="omni-filter-bar">
        <div className="omni-search-part">
          <Search size={15} className="omni-search-icon" />
          <input
            type="text"
            placeholder="Buscar concepto, tarjeta o pago..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="omni-divider desktop-only" />

        <div className="omni-filters-part">
          <CustomSelect
            id="select-tx-type-filter"
            value={txTypeFilter}
            onChange={val => setTxTypeFilter(val as 'ALL' | 'FIXED' | 'VARIABLE' | 'CARD_PAYMENTS' | 'INCOMES' | 'PAYABLES')}
            options={[
              {
                value: 'ALL',
                label: `Todos • ${combinedMovements.length}`,
                icon: <Layers size={14} style={{ color: '#38bdf8' }} />
              },
              {
                value: 'VARIABLE',
                label: `Variables • ${currentMonthTransactions.filter(t => !t.isFixedSubscription).length}`,
                icon: <TrendingDown size={14} style={{ color: '#f87171' }} />
              },
              {
                value: 'FIXED',
                label: `Fijos • ${currentMonthTransactions.filter(t => t.isFixedSubscription).length}`,
                icon: <Repeat size={14} style={{ color: '#fbbf24' }} />
              },
              {
                value: 'CARD_PAYMENTS',
                label: `Pagos Tarjeta • ${currentMonthCardPayments.length}`,
                icon: <CreditCard size={14} style={{ color: '#a78bfa' }} />
              },
              {
                value: 'INCOMES',
                label: `Ingresos • ${salaries.length + currentOtherIncomes.length + currentMonthReceivablePaymentsCount}`,
                icon: <TrendingUp size={14} style={{ color: '#10b981' }} />
              },
              {
                value: 'PAYABLES',
                label: `Pagos Deudas • ${payables.flatMap(p => p.payments || []).filter(pay => pay.paymentDate.startsWith(monthKey)).length}`,
                icon: <ArrowUpRight size={14} style={{ color: '#f59e0b' }} />
              }
            ]}
          />

          <CustomSelect
            id="select-tx-method-filter"
            value={selectedPaymentMethod}
            onChange={val => setSelectedPaymentMethod(val)}
            options={[
              {
                value: 'ALL',
                label: 'Todas las Tarjetas / Cuentas',
                icon: <CreditCard size={14} style={{ color: 'var(--text-muted)' }} />
              },
              ...paymentMethods.map(pm => ({
                value: pm.id,
                label: pm.name,
                colorDot: pm.color || '#6366f1',
                icon: pm.type === 'credit' ? (
                  <CreditCard size={14} style={{ color: pm.color || '#6366f1' }} />
                ) : (
                  <Banknote size={14} style={{ color: pm.color || '#10b981' }} />
                )
              }))
            ]}
          />

          <CustomSelect
            id="select-tx-category-filter"
            value={selectedCategory}
            onChange={val => setSelectedCategory(val)}
            options={[
              { value: 'ALL', label: 'Todas las Categorías', icon: <Tag size={14} style={{ color: 'var(--text-muted)' }} /> },
              ...categories.map(c => ({
                value: c.id,
                label: c.name,
                colorDot: c.color || '#8b5cf6',
                icon: <Tag size={14} style={{ color: c.color || 'var(--text-muted)' }} />
              }))
            ]}
          />

          <button
            type="button"
            className={`omni-clear-icon-btn ${isAnyFilterActive ? 'active' : ''}`}
            onClick={handleResetFilters}
            title={isAnyFilterActive ? 'Limpiar filtros aplicados' : 'Sin filtros activos'}
            aria-label="Limpiar filtros"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Aviso Zen de Salidas por Pagos a Tarjetas */}
      {currentMonthCardPayments.length > 0 && (
        <div className="zen-notice-bar">
          <div className="zen-notice-left">
            <span className="zen-notice-dot" />
            <span>
              Amortizaciones de TC: Has transferido <strong>{formatSoles(currentMonthCardPayments.reduce((a, b) => a + b.amountPaid, 0))}</strong> en <strong>{currentMonthCardPayments.length} {currentMonthCardPayments.length === 1 ? 'pago a tarjeta' : 'pagos a tarjetas'}</strong> este mes que redujeron tu deuda bancaria.
            </span>
          </div>
          <div className="zen-notice-actions">
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '3px 10px', fontSize: '0.75rem' }}
              onClick={() => setTxTypeFilter(txTypeFilter === 'CARD_PAYMENTS' ? 'ALL' : 'CARD_PAYMENTS')}
            >
              {txTypeFilter === 'CARD_PAYMENTS' ? 'Ver Todos' : 'Ver Pagos'}
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '3px 10px', fontSize: '0.75rem' }}
              onClick={handleOpenCreateCardPayment}
            >
              + Registrar Abono
            </button>
          </div>
        </div>
      )}

      {/* Vista Escritorio: Tabla Zen de 6 Columnas Niveladas */}
      <div className="desktop-only table-responsive">
        <table className="tx-table">
          <thead>
            <tr>
              <th style={{ width: '105px' }}>Fecha</th>
              <th>Concepto & Detalle</th>
              <th style={{ width: '160px' }}>Medio de Pago</th>
              <th className="text-right" style={{ width: '135px', whiteSpace: 'nowrap' }}>Monto</th>
              <th style={{ width: '165px', textAlign: 'center' }}>Liquidación</th>
              <th className="text-center" style={{ width: '80px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {combinedMovements.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                  No hay movimientos registrados en {monthNames[currentMonth]} {currentYear} con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              <>
                {combinedMovements.map((item, idx) => {
                  const isDividerHere = isCurrentMonthViewed && idx === todayDividerIndex;

                  if (item.kind === 'income') {
                    const inc = item.data;
                    const isFuture = isItemFuture(inc.date);
                    return (
                      <React.Fragment key={inc.id}>
                        {isDividerHere && renderTodayDividerRow(idx)}
                        <tr style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                          <td className="tabular-nums text-body-sm text-muted">{formatDisplayDate(inc.date)}</td>
                          <td>
                            <div className="tx-concept-main">
                              <span>{inc.description}</span>
                              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>🟢 Ingreso</span>
                            </div>
                            <div className="tx-concept-sub">
                              {inc.type === 'salary' ? 'Sueldo / Nómina fija' : 'Ingreso Extraordinario'}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ color: '#10b981' }}>
                              Cuenta Débito / Bancos
                            </span>
                          </td>
                          <td className="tx-amount-cell" style={{ color: 'var(--accent-success)' }}>
                            +{formatSoles(inc.amount)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isFuture ? (
                              <span className="badge badge-scheduled" title="Ingreso programado a recibir en la fecha indicada. Aún no figura en el saldo de hoy.">
                                ⏳ Programado
                              </span>
                            ) : (
                              <span className="badge badge-collected" title={`Fondos ya cobrados y acreditados en tu cuenta el ${formatDisplayDate(inc.date)}`}>
                                ✓ Cobrado
                              </span>
                            )}
                          </td>
                          <td className="text-center text-muted" style={{ fontSize: '0.75rem' }}>
                            Efectivo
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  if (item.kind === 'payable_payment') {
                    const pay = item.data;
                    const isFuture = isItemFuture(pay.paymentDate);
                    return (
                      <React.Fragment key={pay.id}>
                        {isDividerHere && renderTodayDividerRow(idx)}
                        <tr style={{ background: 'rgba(245, 158, 11, 0.03)' }}>
                          <td className="tabular-nums text-body-sm text-muted">{formatDisplayDate(pay.paymentDate)}</td>
                          <td>
                            <div className="tx-concept-main">
                              <span>Amortización a {pay.creditorName}</span>
                              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Deuda Mía</span>
                            </div>
                            <div className="tx-concept-sub">
                              {pay.description || 'Devolución de deuda'}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ color: '#10b981' }}>
                              Cuenta Débito / Bancos
                            </span>
                          </td>
                          <td className="tx-amount-cell" style={{ color: 'var(--accent-danger)' }}>
                            {pay.currency === 'USD' ? (
                              <div>
                                <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>-$ {pay.amount.toFixed(2)} USD</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>-{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                              </div>
                            ) : (
                              `-${formatSoles(pay.amount)}`
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isFuture ? (
                              <span className="badge badge-scheduled" title="Amortización programada. Se debitará al llegar la fecha.">
                                ⏳ Programado
                              </span>
                            ) : (
                              <span className="badge badge-immediate" title={`Descontado en el acto de tu cuenta débito el ${formatDisplayDate(pay.paymentDate)}`}>
                                ⚡ Inmediato
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="Ver en Mis Deudas"
                              onClick={() => navigateToPayableCreditor(pay.creditorName)}
                            >
                              <ExternalLink size={14} />
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  if (item.kind === 'receivable_payment') {
                    const pay = item.data;
                    const isFuture = isItemFuture(pay.paymentDate);
                    return (
                      <React.Fragment key={pay.id}>
                        {isDividerHere && renderTodayDividerRow(idx)}
                        <tr style={{ background: 'rgba(16, 185, 129, 0.03)' }}>
                          <td className="tabular-nums text-body-sm text-muted">{formatDisplayDate(pay.paymentDate)}</td>
                          <td>
                            <div className="tx-concept-main">
                              <span>Cobro de préstamo: {pay.debtorName}</span>
                              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Cobro Préstamo</span>
                            </div>
                            <div className="tx-concept-sub">
                              {pay.description || 'Abono recibido'}{pay.notes ? ` • ${pay.notes}` : ''}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ color: '#10b981' }}>
                              Cuenta Débito / Bancos
                            </span>
                          </td>
                          <td className="tx-amount-cell" style={{ color: 'var(--accent-success)' }}>
                            {pay.currency === 'USD' ? (
                              <div>
                                <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>+$ {pay.amount.toFixed(2)} USD</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>+{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                              </div>
                            ) : (
                              `+${formatSoles(pay.amount)}`
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isFuture ? (
                              <span className="badge badge-scheduled" title="Cobro programado. Se acreditará al llegar la fecha.">
                                ⏳ Programado
                              </span>
                            ) : (
                              <span className="badge badge-immediate" title={`Acreditado en el acto a tu cuenta débito el ${formatDisplayDate(pay.paymentDate)}`}>
                                ⚡ Inmediato
                              </span>
                            )}
                          </td>
                          <td className="text-center" style={{ whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="Editar fecha o notas de este cobro"
                              style={{ marginRight: '4px' }}
                              onClick={() => handleOpenEditCollectPayment(pay.receivableId, {
                                id: pay.id,
                                receivableId: pay.receivableId,
                                amount: pay.amount,
                                amountPaid: pay.amount,
                                paymentDate: pay.paymentDate,
                                notes: pay.notes
                              }, pay.debtorName)}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="Ver en Préstamos (Me Deben)"
                              onClick={() => navigateToDebtor(pay.debtorName)}
                            >
                              <ExternalLink size={13} />
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  if (item.kind === 'scheduled_payable') {
                    const sch = item.data;
                    return (
                      <React.Fragment key={sch.id}>
                        {isDividerHere && renderTodayDividerRow(idx)}
                        <tr style={{ background: 'rgba(245, 158, 11, 0.03)' }}>
                          <td className="tabular-nums text-body-sm text-muted">{formatDisplayDate(sch.dueDate)}</td>
                          <td>
                            <div className="tx-concept-main">
                              <span>Vencimiento: {sch.creditorName}</span>
                              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Deuda por Vencer</span>
                            </div>
                            <div className="tx-concept-sub">{sch.description || 'Pago de deuda programado'}</div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ color: '#10b981' }}>
                              Cuenta Débito / Bancos
                            </span>
                          </td>
                          <td className="tx-amount-cell" style={{ color: 'var(--accent-warning)' }}>
                            {sch.currency === 'USD' ? (
                              <div>
                                <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>-$ {sch.remaining.toFixed(2)} USD</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>-{formatSoles(sch.amountPen)}</span>
                              </div>
                            ) : (
                              `-${formatSoles(sch.amountPen)}`
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-scheduled" title="Pago de deuda con fecha de vencimiento. Ya se considera en el flujo de caja proyectado; aún no se ha debitado de tu cuenta.">
                              ⏳ Programado
                            </span>
                          </td>
                          <td className="text-center text-muted" style={{ fontSize: '0.75rem' }}>
                            Programado
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  if (item.kind === 'card_payment') {
                    const pay = item.data;
                    const pm = paymentMethods.find(p => p.id === pay.paymentMethodId);
                    const isRefundSource = pay.sourceType === 'MERCHANT_REFUND' || pay.sourceType === 'BANK_CREDIT';
                    const isFuture = isItemFuture(pay.paymentDate);
                    return (
                      <React.Fragment key={pay.id || `cp-tx-${item.index}`}>
                        {isDividerHere && renderTodayDividerRow(idx)}
                        <tr style={{ background: isRefundSource ? 'rgba(16, 185, 129, 0.03)' : 'rgba(99, 102, 241, 0.03)' }}>
                          <td className="tabular-nums text-body-sm text-muted">{formatDisplayDate(pay.paymentDate)}</td>
                          <td>
                            <div className="tx-concept-main">
                              <span>{isRefundSource ? `Reembolso a ${pm?.name || 'Tarjeta'}` : `Pago a ${pm?.name || 'Tarjeta de Crédito'}`}</span>
                              <span className={`badge ${isRefundSource ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>
                                {isRefundSource ? 'Reembolso' : 'Amortización Tarjeta'}
                              </span>
                            </div>
                            <div className="tx-concept-sub">
                              {isRefundSource ? 'Abono externo de comercio / banco' : 'Amortización ciclo facturado'}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ color: pm?.color }}>
                              {isRefundSource ? 'Comercio / Banco' : 'Cuenta Débito / Bancos'}
                            </span>
                          </td>
                          <td className="tx-amount-cell" style={{ color: isRefundSource ? 'var(--accent-success)' : 'var(--accent-brand)' }}>
                            {isRefundSource ? `+${formatSoles(pay.amountPaid)}` : `-${formatSoles(pay.amountPaid)}`}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isFuture ? (
                              <span className="badge badge-scheduled" title="Pago a tarjeta programado. Se debitará al llegar la fecha.">
                                ⏳ Programado
                              </span>
                            ) : (
                              <span className="badge badge-immediate" title={`Abono transferido a la tarjeta el ${formatDisplayDate(pay.paymentDate)}`}>
                                ⚡ Inmediato
                              </span>
                            )}
                          </td>
                          <td className="text-center">
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                className="btn-action-icon"
                                onClick={() => handleOpenEditCardPayment(pay, item.index)}
                                title="Modificar este abono a tarjeta"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="btn-action-icon"
                                onClick={() => handleDeleteCardPayment(pay.id, item.index)}
                                title="Eliminar este pago y revertir el descuento en saldo débito"
                                style={{ color: 'var(--accent-danger)' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  }

                  const t = item.data;
                  const cat = categories.find(c => c.id === t.categoryId);
                  const pm = resolvePaymentMethod(t, paymentMethods);
                  const isDeferred = pm?.type === 'credit' && !t.isRefund;
                  const isFuture = isItemFuture(t.date);

                  return (
                    <React.Fragment key={t.id}>
                      {isDividerHere && renderTodayDividerRow(idx)}
                      <tr className={t.isFixedSubscription ? 'row-fixed-expense' : ''} style={{ background: t.isRefund ? 'rgba(16, 185, 129, 0.04)' : undefined }}>
                        <td className="tabular-nums text-body-sm text-muted">{formatDisplayDate(t.date)}</td>
                        <td>
                          <div className="tx-concept-main">
                            <span
                              style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}
                              title={t.description}
                            >
                              {t.description}
                            </span>
                            {t.isFixedSubscription && (
                              <span className="badge-fixed-tag" title="Gasto Fijo Recurrente">
                                <Repeat size={10} /> <span>Fijo</span>
                              </span>
                            )}
                            {t.isRefund && (
                              <span className="badge badge-success" style={{ fontSize: '0.625rem' }} title="Reembolso o anulación con abono inmediato">
                                🟢 Reembolso
                              </span>
                            )}
                            {t.isInstallment && (
                              <span className="badge badge-neutral" style={{ fontSize: '0.625rem', color: '#6366f1' }} title={`Cuota ${t.currentInstallment} de ${t.totalInstallments}`}>
                                Cuota {t.currentInstallment}/{t.totalInstallments}
                              </span>
                            )}
                          </div>
                          <div className="tx-concept-sub" title={cat?.name || 'General'}>
                            {cat?.name || 'General'}
                          </div>
                        </td>
                        <td title={pm?.name || 'Débito / Efectivo'}>
                          <span
                            className="badge badge-neutral"
                            style={{ color: pm?.color || 'var(--text-secondary)', display: 'inline-block', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={pm?.name || 'Débito / Efectivo'}
                          >
                            {pm?.name || 'Débito / Efectivo'}
                          </span>
                        </td>
                        <td className="tx-amount-cell" style={{ color: t.isRefund ? 'var(--accent-success)' : 'var(--text-primary)' }}>
                          <div>
                            {t.isRefund ? `+${formatSoles(t.amountPen)}` : formatSoles(t.amountPen)}
                          </div>
                          {t.currency === 'USD' && (
                            <div className="tx-amount-orig" title={`Monto en moneda original: $${t.originalAmount.toFixed(2)} USD`}>
                              ${t.originalAmount.toFixed(2)} USD
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {t.isRefund ? (
                            <span className="badge badge-collected" title="Reembolso o anulación con abono inmediato">
                              🟢 Reembolso
                            </span>
                          ) : isDeferred ? (
                            isFuture ? (
                              <span className="badge badge-scheduled" title={`Gasto programado con TC. Vencerá en tu banco el ${formatDisplayDate(t.paymentDueDate)}`}>
                                ⏳ Programado{t.paymentDueDate ? ` • ${formatShortDate(t.paymentDueDate)}` : ''}
                              </span>
                            ) : (
                              <span className="badge badge-deferred" title={`Compra en TC. Vence en tu banco el ${formatDisplayDate(t.paymentDueDate)}`}>
                                📅 Vence {formatShortDate(t.paymentDueDate)}
                              </span>
                            )
                          ) : (
                            isFuture ? (
                              <span className="badge badge-scheduled" title="Gasto en débito programado. Se descontará al llegar la fecha.">
                                ⏳ Programado
                              </span>
                            ) : (
                              <span className="badge badge-immediate" title={`Descontado en el acto de tu cuenta débito el ${formatDisplayDate(t.date)}`}>
                                ⚡ Inmediato
                              </span>
                            )
                          )}
                        </td>
                        <td className="text-center">
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="btn-action-icon" onClick={() => handleOpenEditTransaction(t)} title="Editar gasto">
                              <Pencil size={14} />
                            </button>
                            <button className="btn-action-icon" onClick={() => promptDeleteTransaction(t)} title="Eliminar gasto">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {todayDividerIndex === -1 && isCurrentMonthViewed && combinedMovements.length > 0 && renderTodayDividerRow('end')}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Vista Móvil: Feed Táctil de Tarjetas */}
      <div className="mobile-only mobile-tx-feed">
        {combinedMovements.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay movimientos con los filtros seleccionados
          </div>
        ) : (
          <>
            {combinedMovements.map((item, idx) => {
              const isDividerHere = isCurrentMonthViewed && idx === todayDividerIndex;

              if (item.kind === 'income') {
                const inc = item.data;
                const isFuture = isItemFuture(inc.date);
                return (
                  <React.Fragment key={inc.id}>
                    {isDividerHere && renderTodayDividerMobile(idx)}
                    <div className="mobile-tx-card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
                      <div className="mobile-tx-main-row">
                        <div className="mobile-tx-left">
                          <div className="mobile-tx-icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                            <TrendingUp size={16} />
                          </div>
                          <div className="mobile-tx-info">
                            <div className="mobile-tx-title-row">
                              <span className="mobile-tx-title">{inc.description}</span>
                            </div>
                            <div className="mobile-tx-meta">
                              <span>{formatDisplayDate(inc.date)}</span>
                              <span>•</span>
                              <span>{inc.type === 'salary' ? 'Sueldo / Nómina' : 'Ingreso extra'}</span>
                              <span>•</span>
                              <span style={{ color: 'var(--accent-success)', fontWeight: 500 }}>Débito</span>
                            </div>
                          </div>
                        </div>
                        <div className="mobile-tx-right">
                          <div className="mobile-tx-tags">
                            <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Ingreso</span>
                          </div>
                          <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-success)' }}>+{formatSoles(inc.amount)}</span>
                        </div>
                      </div>
                      <div className="mobile-tx-footer-row">
                        {isFuture ? (
                          <>
                            <span className="badge badge-scheduled" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⏳ Programado</span>
                            <span className="mobile-tx-due">Se acredita el {formatDisplayDate(inc.date)}</span>
                          </>
                        ) : (
                          <>
                            <span className="badge badge-collected" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>✓ Cobrado</span>
                            <span className="mobile-tx-due" style={{ color: 'var(--accent-success)' }}>Acreditado el {formatDisplayDate(inc.date)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              if (item.kind === 'payable_payment') {
                const pay = item.data;
                const isFuture = isItemFuture(pay.paymentDate);
                return (
                  <React.Fragment key={pay.id}>
                    {isDividerHere && renderTodayDividerMobile(idx)}
                    <div className="mobile-tx-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <div className="mobile-tx-main-row">
                        <div className="mobile-tx-left">
                          <div className="mobile-tx-icon-wrap" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                            <ArrowUpRight size={16} />
                          </div>
                          <div className="mobile-tx-info">
                            <div className="mobile-tx-title-row">
                              <span className="mobile-tx-title" title={`Pago a ${pay.creditorName}`}>Pago a {pay.creditorName}</span>
                            </div>
                            <div className="mobile-tx-meta" title={`${formatDisplayDate(pay.paymentDate)} • ${pay.description}`}>
                              <span>{formatDisplayDate(pay.paymentDate)}</span>
                              <span>•</span>
                              <span>{pay.description || 'Devolución de deuda'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mobile-tx-right">
                          <div className="mobile-tx-tags">
                            <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Deuda</span>
                          </div>
                          {pay.currency === 'USD' ? (
                            <div style={{ textAlign: 'right' }}>
                              <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-danger)' }}>-$ {pay.amount.toFixed(2)} USD</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>-{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                            </div>
                          ) : (
                            <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-danger)' }}>-{formatSoles(pay.amount)}</span>
                          )}
                        </div>
                      </div>
                      <div className="mobile-tx-footer-row">
                        {isFuture ? (
                          <>
                            <span className="badge badge-scheduled" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⏳ Programado</span>
                            <span className="mobile-tx-due">Se debita el {formatDisplayDate(pay.paymentDate)}</span>
                          </>
                        ) : (
                          <>
                            <span className="badge badge-immediate" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⚡ Inmediato</span>
                            <span className="mobile-tx-due">Debitado el {formatDisplayDate(pay.paymentDate)}</span>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn-action-icon"
                          style={{ marginLeft: 'auto' }}
                          title="Ver en Mis Deudas"
                          onClick={() => navigateToPayableCreditor(pay.creditorName)}
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              if (item.kind === 'receivable_payment') {
                const pay = item.data;
                const isFuture = isItemFuture(pay.paymentDate);
                return (
                  <React.Fragment key={pay.id}>
                    {isDividerHere && renderTodayDividerMobile(idx)}
                    <div className="mobile-tx-card" style={{ borderLeft: '4px solid #10b981' }}>
                      <div className="mobile-tx-main-row">
                        <div className="mobile-tx-left">
                          <div className="mobile-tx-icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                            <TrendingUp size={16} />
                          </div>
                          <div className="mobile-tx-info">
                            <div className="mobile-tx-title-row">
                              <span className="mobile-tx-title" title={`Cobro a ${pay.debtorName}`}>Cobro a {pay.debtorName}</span>
                            </div>
                            <div className="mobile-tx-meta" title={`${formatDisplayDate(pay.paymentDate)} • ${pay.description}`}>
                              <span>{formatDisplayDate(pay.paymentDate)}</span>
                              <span>•</span>
                              <span>{pay.description || 'Abono recibido'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mobile-tx-right">
                          <div className="mobile-tx-tags">
                            <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Cobro</span>
                          </div>
                          {pay.currency === 'USD' ? (
                            <div style={{ textAlign: 'right' }}>
                              <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-success)' }}>+$ {pay.amount.toFixed(2)} USD</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>+{formatSoles(pay.amount * (pay.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                            </div>
                          ) : (
                            <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-success)' }}>+{formatSoles(pay.amount)}</span>
                          )}
                        </div>
                      </div>
                      <div className="mobile-tx-footer-row">
                        {isFuture ? (
                          <>
                            <span className="badge badge-scheduled" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⏳ Programado</span>
                            <span className="mobile-tx-due">Se acredita el {formatDisplayDate(pay.paymentDate)}</span>
                          </>
                        ) : (
                          <>
                            <span className="badge badge-immediate" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⚡ Inmediato</span>
                            <span className="mobile-tx-due">Acreditado el {formatDisplayDate(pay.paymentDate)}</span>
                          </>
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="Editar fecha o notas de este cobro"
                            onClick={() => handleOpenEditCollectPayment(pay.receivableId, {
                              id: pay.id,
                              receivableId: pay.receivableId,
                              amount: pay.amount,
                              amountPaid: pay.amount,
                              paymentDate: pay.paymentDate,
                              notes: pay.notes
                            }, pay.debtorName)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="Ver en Préstamos (Me Deben)"
                            onClick={() => navigateToDebtor(pay.debtorName)}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              if (item.kind === 'scheduled_payable') {
                const sch = item.data;
                return (
                  <React.Fragment key={sch.id}>
                    {isDividerHere && renderTodayDividerMobile(idx)}
                    <div className="mobile-tx-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <div className="mobile-tx-main-row">
                        <div className="mobile-tx-left">
                          <div className="mobile-tx-icon-wrap" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                            <ArrowUpRight size={16} />
                          </div>
                          <div className="mobile-tx-info">
                            <div className="mobile-tx-title-row">
                              <span className="mobile-tx-title" title={`Vencimiento: ${sch.creditorName}`}>Vencimiento: {sch.creditorName}</span>
                            </div>
                            <div className="mobile-tx-meta" title={sch.description}>
                              <span>{sch.description || 'Pago de deuda programado'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mobile-tx-right">
                          <div className="mobile-tx-tags">
                            <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Deuda por Vencer</span>
                          </div>
                          {sch.currency === 'USD' ? (
                            <div style={{ textAlign: 'right' }}>
                              <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-warning)' }}>-$ {sch.remaining.toFixed(2)} USD</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>-{formatSoles(sch.amountPen)}</span>
                            </div>
                          ) : (
                            <span className="mobile-tx-amount tabular-nums" style={{ color: 'var(--accent-warning)' }}>-{formatSoles(sch.amountPen)}</span>
                          )}
                        </div>
                      </div>
                      <div className="mobile-tx-footer-row">
                        <span className="badge badge-scheduled" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⏳ Programado</span>
                        <span className="mobile-tx-due">Vence el {formatDisplayDate(sch.dueDate)}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              if (item.kind === 'card_payment') {
                const pay = item.data;
                const pm = paymentMethods.find(p => p.id === pay.paymentMethodId);
                const isRefund = pay.sourceType === 'MERCHANT_REFUND' || pay.sourceType === 'BANK_CREDIT';
                const isFuture = isItemFuture(pay.paymentDate);
                return (
                  <React.Fragment key={pay.id || `cp-m-${item.index}`}>
                    {isDividerHere && renderTodayDividerMobile(idx)}
                    <div className="mobile-tx-card" style={{ borderLeft: `4px solid ${isRefund ? 'var(--accent-success)' : 'var(--accent-brand)'}` }}>
                      <div className="mobile-tx-main-row">
                        <div className="mobile-tx-left">
                          <div className="mobile-tx-icon-wrap" style={{ backgroundColor: `${pm?.color || '#10b981'}20`, color: pm?.color || '#10b981' }}>
                            <CreditCard size={16} />
                          </div>
                          <div className="mobile-tx-info">
                            <div className="mobile-tx-title-row">
                              <span className="mobile-tx-title" title={isRefund ? `Reembolso ${pm?.name || 'Tarjeta'}` : `Pago a ${pm?.name || 'Tarjeta'}`}>
                                {isRefund ? `Reembolso ${pm?.name || 'Tarjeta'}` : `Pago a ${pm?.name || 'Tarjeta'}`}
                              </span>
                            </div>
                            <div className="mobile-tx-meta" title={`${formatDisplayDate(pay.paymentDate)} • ${isRefund ? 'Comercio/Banco' : 'Débito'}`}>
                              <span>{formatDisplayDate(pay.paymentDate)}</span>
                              <span>•</span>
                              {isFuture ? (
                                <span className="badge badge-scheduled" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>⏳ Programado</span>
                              ) : (
                                <span className="badge badge-immediate" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>⚡ Inmediato</span>
                              )}
                              <span>•</span>
                              <span style={{ color: 'var(--accent-brand)', fontWeight: 500 }}>{isRefund ? 'Comercio/Banco' : 'Débito'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mobile-tx-right">
                          <div className="mobile-tx-tags">
                            <span className={`badge ${isRefund ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                              {isRefund ? 'Reembolso' : 'Amortización'}
                            </span>
                          </div>
                          <span className="mobile-tx-amount tabular-nums" style={{ color: isRefund ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                            {isRefund ? `+${formatSoles(pay.amountPaid)}` : `-${formatSoles(pay.amountPaid)}`}
                          </span>
                          <div className="mobile-tx-actions">
                            <button className="btn-action-icon" onClick={() => handleOpenEditCardPayment(pay, item.index)} title="Modificar pago">
                              <Pencil size={13} />
                            </button>
                            <button className="btn-action-icon" onClick={() => handleDeleteCardPayment(pay.id, item.index)} title="Eliminar pago y restaurar saldo débito" style={{ color: 'var(--accent-danger)' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              const t = item.data;
              const cat = categories.find(c => c.id === t.categoryId);
              const pm = resolvePaymentMethod(t, paymentMethods);
              const isDeferred = pm?.type === 'credit' && !t.isRefund;
              const isFuture = isItemFuture(t.date);

              return (
                <React.Fragment key={t.id}>
                  {isDividerHere && renderTodayDividerMobile(idx)}
                  <div className={`mobile-tx-card ${t.isFixedSubscription ? 'mobile-tx-card-fixed' : ''}`} style={{ borderLeft: t.isRefund ? '4px solid var(--accent-success)' : undefined }}>
                    <div className="mobile-tx-main-row">
                      <div className="mobile-tx-left">
                        <div className="mobile-tx-icon-wrap" style={{ backgroundColor: t.isRefund ? 'rgba(16, 185, 129, 0.15)' : `${cat?.color || '#6366f1'}18`, color: t.isRefund ? '#10b981' : (cat?.color || '#6366f1') }}>
                          <Tag size={16} />
                        </div>
                        <div className="mobile-tx-info">
                          <div className="mobile-tx-title-row">
                            <span className="mobile-tx-title" title={t.description}>{t.description}</span>
                          </div>
                          <div className="mobile-tx-meta" title={`${formatDisplayDate(t.date)} • ${cat?.name || 'General'} • ${pm?.name || 'Débito / Efectivo'}`}>
                            <span>{formatDisplayDate(t.date)}</span> <span>•</span> <span>{cat?.name || 'General'}</span> <span>•</span> <span style={{ color: pm?.color || 'var(--text-secondary)', fontWeight: 500 }}>{pm?.name || 'Débito / Efectivo'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mobile-tx-right">
                        {(t.isFixedSubscription || t.isRefund || t.isInstallment) && (
                          <div className="mobile-tx-tags">
                            {t.isFixedSubscription && (
                              <span className="badge-fixed-tag" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Fijo</span>
                            )}
                            {t.isRefund && (
                              <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Reembolso</span>
                            )}
                            {t.isInstallment && (
                              <span className="badge badge-neutral" style={{ fontSize: '0.6rem', padding: '1px 5px', color: '#6366f1' }}>
                                Cuota {t.currentInstallment}/{t.totalInstallments}
                              </span>
                            )}
                          </div>
                        )}
                        <span className="mobile-tx-amount tabular-nums" style={{ color: t.isRefund ? 'var(--accent-success)' : undefined }}>
                          {t.isRefund ? `+${formatSoles(t.amountPen)}` : formatSoles(t.amountPen)}
                        </span>
                        <div className="mobile-tx-actions">
                          <button className="btn-action-icon" onClick={() => handleOpenEditTransaction(t)} title="Editar gasto">
                            <Pencil size={13} />
                          </button>
                          <button className="btn-action-icon" onClick={() => promptDeleteTransaction(t)} title="Eliminar gasto">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {t.isRefund ? (
                      <div className="mobile-tx-footer-row">
                        <span className="badge badge-collected" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>Reembolso</span>
                        <span className="mobile-tx-due" style={{ color: 'var(--accent-success)' }}>Acreditado el {formatDisplayDate(t.date)}</span>
                      </div>
                    ) : isDeferred ? (
                      <div className="mobile-tx-footer-row">
                        {isFuture ? (
                          <>
                            <span className="badge badge-scheduled" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⏳ Programado</span>
                            <span className="mobile-tx-due">Vence el {formatDisplayDate(t.paymentDueDate)}</span>
                          </>
                        ) : (
                          <>
                            <span className="badge badge-deferred" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>📅 Diferido</span>
                            <span className="mobile-tx-due">Vence el {formatDisplayDate(t.paymentDueDate)}</span>
                          </>
                        )}
                      </div>
                    ) : isFuture ? (
                      <div className="mobile-tx-footer-row">
                        <span className="badge badge-scheduled" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>⏳ Programado</span>
                        <span className="mobile-tx-due" style={{ color: 'var(--text-muted)' }}>Descuento el {formatDisplayDate(t.date)}</span>
                      </div>
                    ) : null}
                  </div>
                </React.Fragment>
              );
            })}
            {todayDividerIndex === -1 && isCurrentMonthViewed && combinedMovements.length > 0 && renderTodayDividerMobile('end')}
          </>
        )}
      </div>
    </section>
  );
};
