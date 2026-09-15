'use client';

import React from 'react';
import { FALLBACK_USD_PEN_RATE, FALLBACK_USD_PEN_RATE_STR4 } from '@/lib/constants';
import { useFinance } from '@/contexts/FinanceContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Coins,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Users
} from 'lucide-react';

export const ReceivablesTab: React.FC = () => {
  const {
    totalReceivablesRemaining,
    totalPayablesRemaining,
    totalReceivablesRemainingUsd,
    totalPayablesRemainingUsd,
    receivables,
    payables,
    loansSubTab,
    setLoansSubTab,
    setDebtorName,
    setLoanDesc,
    setLoanAmount,
    setIsReceivableModalOpen,
    receivablesFilter,
    setReceivablesFilter,
    debtorGroups,
    filteredDebtorGroups,
    expandedDebtors,
    toggleDebtorExpanded,
    handleOpenGroupCollectModal,
    handleCascadeCollect,
    handleOpenAddLoanForDebtor,
    handleOpenCollectModal,
    handleOpenEditReceivable,
    setEditingReceivableId,
    handleOpenEditPayable,
    setItemToDelete,
    handleOpenCreatePayable,
    payablesFilter,
    setPayablesFilter,
    creditorGroups,
    filteredCreditorGroups,
    expandedCreditors,
    toggleCreditorExpanded,
    handleOpenGroupPayModal,
    handleCascadePay,
    handleOpenAddLoanForCreditor,
    handleOpenPayPayable,
    handleDeletePayable,
    formatDisplayDate,
    formatSoles
  } = useFinance();
  // Cálculos consolidados para los 4 KPIs superiores
  const pendingReceivablesCount = receivables.filter(r => r.remainingAmount > 0).length;
  const activePayablesCount = payables.filter(p => (p.remainingAmount ?? (p.totalAmount ?? p.originalAmount)) > 0).length;

  const totalReceivablesOrig = receivables.reduce((a, b) => a + b.originalAmount, 0);

  const totalPayablesOrig = payables.reduce((a, b) => a + (b.totalAmount ?? b.originalAmount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 1. KPIs de Préstamos y Deudas (2 Columnas Simétricas al 100%) */}
      <div className="loans-kpi-grid">
        <div className="loans-kpi-card" style={{ borderLeft: '4px solid var(--accent-success)' }} title="Total de dinero que has prestado a terceros y aún está pendiente de devolución">
          <div className="loans-kpi-label">
            <span>Me Deben</span>
            <ArrowDownLeft size={15} color="var(--accent-success)" />
          </div>
          <div className="loans-kpi-value tabular-nums" style={{ color: 'var(--accent-success)' }}>
            {formatSoles(totalReceivablesRemaining)}
          </div>
          <div className="loans-kpi-sub">
            <span>{pendingReceivablesCount} {pendingReceivablesCount === 1 ? 'deuda pendiente' : 'deudas pendientes'} de terceros</span>
          </div>
        </div>

        <div className="loans-kpi-card" style={{ borderLeft: '4px solid var(--accent-warning)' }} title="Total de dinero que te han prestado y tienes pendiente de pagar a tus acreedores">
          <div className="loans-kpi-label">
            <span>Yo Debo</span>
            <ArrowUpRight size={15} color="var(--accent-warning)" />
          </div>
          <div className="loans-kpi-value tabular-nums" style={{ color: 'var(--accent-warning)' }}>
            {formatSoles(totalPayablesRemaining)}
          </div>
          <div className="loans-kpi-sub">
            <span>{activePayablesCount} {activePayablesCount === 1 ? 'compromiso activo' : 'compromisos activos'}</span>
          </div>
        </div>
      </div>

      {/* 2. Barra Unificada de Control: Subpestañas + Filtros + Botón de Acción Principal */}
      <div className="loans-unified-toolbar">
        {/* Conmutador de Subpestañas */}
        <div className="loans-subtab-switch">
          <button
            id="btn-subtab-receivables"
            type="button"
            className={`loans-subtab-btn ${loansSubTab === 'receivables' ? 'active' : ''}`}
            onClick={() => setLoansSubTab('receivables')}
            title="Ver dinero que prestaste y cuentas por cobrar a terceros"
          >
            <ArrowDownLeft size={16} />
            <span>Me Deben</span>
            <span className="badge badge-success nowrap">{pendingReceivablesCount}</span>
          </button>
          <button
            id="btn-subtab-payables"
            type="button"
            className={`loans-subtab-btn ${loansSubTab === 'payables' ? 'active' : ''}`}
            onClick={() => setLoansSubTab('payables')}
            title="Ver compromisos y deudas pendientes de pagar a personas"
          >
            <ArrowUpRight size={16} />
            <span>Yo Debo</span>
            <span className="badge badge-warning nowrap">{activePayablesCount}</span>
          </button>
        </div>

        {/* Filtros de Estado y Botón de Acción */}
        <div className="loans-toolbar-actions">
          <div className="debtor-filter-bar">
            {loansSubTab === 'receivables' ? (
              <>
                <button
                  type="button"
                  className={`debtor-filter-btn ${receivablesFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setReceivablesFilter('pending')}
                  title="Mostrar personas con saldo pendiente por cobrar"
                >
                  <span>Pendientes</span>
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                    {debtorGroups.filter(g => !g.isFullyPaid).length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`debtor-filter-btn ${receivablesFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setReceivablesFilter('all')}
                  title="Mostrar todos los deudores registrados"
                >
                  <span>Todos</span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                    {debtorGroups.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`debtor-filter-btn ${receivablesFilter === 'paid' ? 'active' : ''}`}
                  onClick={() => setReceivablesFilter('paid')}
                  title="Mostrar personas con préstamos completamente saldados"
                >
                  <span>Historial Saldados</span>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                    {debtorGroups.filter(g => g.isFullyPaid).length}
                  </span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`debtor-filter-btn ${payablesFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setPayablesFilter('pending')}
                  title="Mostrar acreedores con compromisos pendientes por devolver"
                >
                  <span>Pendientes</span>
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                    {creditorGroups.filter(g => !g.isFullyPaid).length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`debtor-filter-btn ${payablesFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setPayablesFilter('all')}
                  title="Mostrar todos los acreedores registrados"
                >
                  <span>Todos</span>
                  <span className="badge badge-neutral" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                    {creditorGroups.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={`debtor-filter-btn ${payablesFilter === 'paid' ? 'active' : ''}`}
                  onClick={() => setPayablesFilter('paid')}
                  title="Mostrar compromisos pagados en su totalidad"
                >
                  <span>Historial Pagados</span>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                    {creditorGroups.filter(g => g.isFullyPaid).length}
                  </span>
                </button>
              </>
            )}
          </div>

          {loansSubTab === 'receivables' ? (
            <button
              id="btn-open-loan-modal"
              className="btn-primary"
              onClick={() => {
                setEditingReceivableId(null);
                setDebtorName('');
                setLoanDesc('');
                setLoanAmount('');
                setIsReceivableModalOpen(true);
              }}
              title="Registrar un nuevo dinero prestado a un tercero"
            >
              <Plus size={15} />
              <span>Nuevo Préstamo</span>
            </button>
          ) : (
            <button
              id="btn-open-payable-modal"
              className="btn-primary"
              onClick={handleOpenCreatePayable}
              title="Registrar un nuevo dinero que te prestaron para devolver"
            >
              <Plus size={15} />
              <span>Registrar Deuda Mía</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Contenido según Subpestaña Activa: Cuadrícula Armoniosa */}
      {loansSubTab === 'receivables' && (
        <>
          {/* Banner Informativo Conciso */}
          <div className="loans-info-banner">
            <div className="loans-info-banner-left">
              <AlertCircle size={16} color="var(--accent-brand)" />
              <span>
                Tienes <strong>{formatSoles(totalReceivablesRemaining)}{totalReceivablesRemainingUsd > 0 ? ` • $ ${totalReceivablesRemainingUsd.toFixed(2)} USD` : ''}</strong> por cobrar. Cuando te paguen, se debita directo a tu cuenta.
              </span>
            </div>
            <div className="loans-info-banner-right">
              <span className="badge badge-neutral" title={`Total prestado históricamente: ${formatSoles(totalReceivablesOrig)}`}>
                {formatSoles(totalReceivablesOrig)} prestado en total
              </span>
            </div>
          </div>

          {/* Cuadrícula Armónica de Fichas de Deudores */}
          <div className="loans-harmonious-grid">
            {filteredDebtorGroups.length === 0 ? (
              <div className="clean-card" style={{ width: '100%', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <Users size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <p style={{ fontWeight: 600 }}>
                  {receivablesFilter === 'pending'
                    ? '¡Excelente! No tienes cuentas por cobrar pendientes'
                    : receivablesFilter === 'paid'
                    ? 'Aún no hay préstamos saldados en el historial'
                    : 'No tienes personas ni préstamos registrados'}
                </p>
                <p style={{ fontSize: '0.85rem' }}>
                  {receivablesFilter === 'pending'
                    ? 'Todos los deudores están al día o saldados.'
                    : 'Registra un préstamo personal usando el botón superior.'}
                </p>
              </div>
            ) : (
              [filteredDebtorGroups.slice(0, Math.ceil(filteredDebtorGroups.length / 2)), filteredDebtorGroups.slice(Math.ceil(filteredDebtorGroups.length / 2))].map((colGroups, colIdx) => (
                <div key={colIdx} className="loans-col">
                  {colGroups.map(group => {
                const isExpanded = expandedDebtors.has(group.key);
                const initialLetter = group.debtorName ? group.debtorName.charAt(0).toUpperCase() : '?';

                return (
                  <div
                    key={group.key}
                    className={`debtor-group-card ${group.isFullyPaid ? 'fully-paid' : ''}`}
                  >
                    {/* 1. Nivel Superior: Identidad del Deudor + Balance Destacado */}
                    <div className="debtor-card-header">
                      <div className="debtor-profile-group">
                        <div className="debtor-avatar" title={`Deudor: ${group.debtorName}`}>
                          {initialLetter}
                        </div>
                        <div className="debtor-info">
                          <div className="debtor-title-row">
                            <span className="debtor-name" title={group.debtorName}>
                              {group.debtorName}
                            </span>
                            <span
                              className={`badge ${group.isFullyPaid ? 'badge-success' : 'badge-warning'} nowrap`}
                              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                              title={group.isFullyPaid ? 'Deuda saldada completamente' : `${group.items.filter(i => i.remainingAmount > 0).length} préstamos pendientes por cobrar`}
                            >
                              {group.isFullyPaid ? '🟢 Saldado al 100%' : `🟡 ${group.items.filter(i => i.remainingAmount > 0).length} por cobrar`}
                            </span>
                            <span className="badge badge-neutral nowrap" style={{ fontSize: '0.7rem' }}>
                              {group.items.length} {group.items.length === 1 ? 'préstamo' : 'préstamos'}
                            </span>
                          </div>
                          <div className="debtor-meta-row">
                            <span className="nowrap" title={`Monto prestado originalmente a ${group.debtorName}: ${formatSoles(group.totalOriginal)}`}>
                              Capital: <strong style={{ color: 'var(--text-primary)' }}>
                                {group.hasUsd
                                  ? (group.isPureUsd
                                      ? `$ ${group.totalOriginalUsd?.toFixed(2)} USD • ${formatSoles(group.totalOriginal)}`
                                      : `${formatSoles(group.totalOriginal)} • $ ${group.totalOriginalUsd?.toFixed(2)} USD`)
                                  : formatSoles(group.totalOriginal)}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="nowrap" title={`Monto que ${group.debtorName} ya devolvió: ${formatSoles(group.totalPaid)}`}>
                              Cobrado: <strong className="text-success">
                                {group.hasUsd
                                  ? (group.isPureUsd
                                      ? `$ ${group.totalPaidUsd?.toFixed(2)} USD • ${formatSoles(group.totalPaid)}`
                                      : `${formatSoles(group.totalPaid)} • $ ${group.totalPaidUsd?.toFixed(2)} USD`)
                                  : formatSoles(group.totalPaid)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Balance Destacado */}
                      <div className="debtor-balance-highlight" title={group.isFullyPaid ? `Total saldado: ${formatSoles(group.totalOriginal)}` : `Monto que ${group.debtorName} aún adeuda: ${formatSoles(group.totalRemaining)}`}>
                        <span className="balance-caption nowrap">
                          {group.isFullyPaid ? 'Total Cancelado' : 'Por Cobrar'}
                        </span>
                        <span
                          className="balance-amount tabular-nums nowrap"
                          style={{
                            color: group.isFullyPaid ? 'var(--accent-success)' : 'var(--accent-warning)'
                          }}
                        >
                          {group.isFullyPaid
                            ? (group.hasUsd && group.isPureUsd ? `$ ${group.totalOriginalUsd?.toFixed(2)} USD` : formatSoles(group.totalOriginal))
                            : (group.hasUsd && group.isPureUsd ? `$ ${group.totalRemainingUsd?.toFixed(2)} USD` : formatSoles(group.totalRemaining))}
                        </span>
                        {group.hasUsd && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                            {group.isPureUsd
                              ? `Equivalente: ${formatSoles(group.isFullyPaid ? group.totalOriginal : group.totalRemaining)}`
                              : `Incluye $ ${(group.isFullyPaid ? group.totalOriginalUsd : group.totalRemainingUsd)?.toFixed(2)} USD`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Nivel Intermedio: Barra de Progreso de Amortización */}
                    <div className="debtor-progress-section" title={`Progreso de amortización: ${group.paidPercentage}% recuperado • ${formatSoles(group.totalPaid)} de ${formatSoles(group.totalOriginal)}`}>
                      <div className="debtor-progress-labels">
                        <span>Amortización acumulada</span>
                        <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>
                          {group.paidPercentage}% • {formatSoles(group.totalPaid)} de {formatSoles(group.totalOriginal)}
                        </span>
                      </div>
                      <div className="progress-track" style={{ height: '6px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${group.paidPercentage}%`,
                            background: group.isFullyPaid ? 'var(--accent-success)' : 'var(--accent-brand)'
                          }}
                        />
                      </div>
                    </div>

                    {/* 3. Nivel Inferior: Barra de Acciones y Desglose */}
                    <div className="debtor-actions-toolbar">
                      <div className="debtor-actions-left">
                        {!group.isFullyPaid && (
                          <>
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenGroupCollectModal(group)}
                              title="Registrar abono que se distribuirá en cascada (FIFO) sobre los préstamos"
                            >
                              <Coins size={13} />
                              <span>Abonar</span>
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              onClick={() => handleCascadeCollect(group.debtorName, group.totalRemaining)}
                              title="Cobrar la deuda restante completa de todos sus préstamos"
                            >
                              <span>Cobrar Todo</span>
                            </button>
                          </>
                        )}
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                          onClick={() => handleOpenAddLoanForDebtor(group.debtorName)}
                          title={`Agregar otro préstamo a nombre de ${group.debtorName}`}
                        >
                          <Plus size={13} />
                          <span>Préstamo</span>
                        </button>
                      </div>

                      <div className="debtor-actions-right">
                        <button
                          className={`btn-toggle-breakdown ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleDebtorExpanded(group.key)}
                          title={isExpanded ? 'Ocultar desglose detallado' : 'Ver desglose detallado de préstamos'}
                        >
                          <span>{isExpanded ? 'Ocultar Detalle' : `Ver Desglose • ${group.items.length}`}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Desglose de Préstamos Individuales */}
                    {isExpanded && (
                      <div className="debtor-breakdown-container">
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Desglose de Préstamos • {group.items.length}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {group.items.map(item => {
                            const itemPaid = item.remainingAmount <= 0;
                            return (
                              <div key={item.id} className="breakdown-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, minWidth: '160px' }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} title={item.description}>
                                    <span>{item.description}</span>
                                    {item.currency === 'USD' && (
                                      <span className="badge badge-neutral nowrap" style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                        USD • TC {item.exchangeRate ? item.exchangeRate.toFixed(4) : FALLBACK_USD_PEN_RATE_STR4}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={`Fecha: ${formatDisplayDate(item.createdAt || item.dueDate)}`}>
                                    Fecha: {formatDisplayDate(item.createdAt || item.dueDate)}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <div style={{ textAlign: 'right' }} title={`Capital prestado: ${item.currency === 'USD' ? `$ ${item.originalAmount.toFixed(2)} USD • ${formatSoles(item.amountPen || (item.originalAmount * (item.exchangeRate || FALLBACK_USD_PEN_RATE)))}` : formatSoles(item.originalAmount)}`}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Prestado</span>
                                    {item.currency === 'USD' ? (
                                      <>
                                        <span className="tabular-nums nowrap" style={{ fontWeight: 600, color: '#38bdf8' }}>$ {item.originalAmount.toFixed(2)} USD</span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{formatSoles(item.amountPen || (item.originalAmount * (item.exchangeRate || FALLBACK_USD_PEN_RATE)))}</span>
                                      </>
                                    ) : (
                                      <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>{formatSoles(item.originalAmount)}</span>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right' }} title={`Amortizado hasta hoy: ${item.currency === 'USD' ? `$ ${item.paidAmount.toFixed(2)} USD` : formatSoles(item.paidAmount)}`}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Amortizado</span>
                                    {item.currency === 'USD' ? (
                                      <>
                                        <span className="tabular-nums nowrap" style={{ color: 'var(--accent-success)', fontWeight: 600 }}>$ {item.paidAmount.toFixed(2)} USD</span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{formatSoles(item.paidAmount * (item.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                                      </>
                                    ) : (
                                      <span className="tabular-nums nowrap" style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{formatSoles(item.paidAmount)}</span>
                                    )}
                                  </div>
                                  <div style={{ textAlign: 'right', minWidth: '70px' }} title={`Saldo por cobrar: ${item.currency === 'USD' ? `$ ${item.remainingAmount.toFixed(2)} USD` : formatSoles(item.remainingAmount)}`}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Saldo</span>
                                    {item.currency === 'USD' ? (
                                      <>
                                        <span className="tabular-nums nowrap" style={{ fontWeight: 700, color: itemPaid ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                          $ {item.remainingAmount.toFixed(2)} USD
                                        </span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{formatSoles(item.remainingAmount * (item.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                                      </>
                                    ) : (
                                      <span className="tabular-nums nowrap" style={{ fontWeight: 700, color: itemPaid ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                        {formatSoles(item.remainingAmount)}
                                      </span>
                                    )}
                                  </div>

                                  <span
                                    className={`badge ${itemPaid ? 'badge-success' : 'badge-warning'} nowrap`}
                                    style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                    title={itemPaid ? 'Préstamo completamente cancelado' : 'Préstamo pendiente de devolución'}
                                  >
                                    {itemPaid ? 'Saldado' : 'Pendiente'}
                                  </span>

                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    {!itemPaid && (
                                      <button
                                        className="btn-primary"
                                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                        onClick={() => handleOpenCollectModal(item)}
                                        title="Abonar a este préstamo específico"
                                      >
                                        Abonar
                                      </button>
                                    )}
                                    <button
                                      className="btn-action-icon"
                                      onClick={() => handleOpenEditReceivable(item)}
                                      title="Editar los datos de este préstamo"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      className="btn-action-icon"
                                      onClick={() => {
                                        setItemToDelete({
                                          id: item.id,
                                          type: 'receivable',
                                          description: `${group.debtorName}: ${item.description}`,
                                          amount: item.remainingAmount > 0 ? item.remainingAmount : item.originalAmount,
                                          date: item.createdAt || item.dueDate,
                                          categoryName: 'Cuenta por Cobrar'
                                        });
                                      }}
                                      title="Eliminar este préstamo específico"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Mis Deudas por Pagar (Sección Simétrica) */}
      {loansSubTab === 'payables' && (
        <>
          {/* Banner Informativo Conciso */}
          <div className="loans-info-banner warning-tint">
            <div className="loans-info-banner-left">
              <AlertCircle size={16} color="var(--accent-warning)" />
              <span>
                Te queda por pagar <strong>{formatSoles(totalPayablesRemaining)}</strong>{totalPayablesRemainingUsd > 0 ? <> <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>· ya incluye $ {totalPayablesRemainingUsd.toFixed(2)} USD convertidos</span></> : ''}. Al abonar, sale de tu cuenta como pago de deuda.
              </span>
            </div>
            <div className="loans-info-banner-right">
              <span className="badge badge-warning" title={`Total pasivo asumido: ${formatSoles(totalPayablesOrig)}`}>
                {formatSoles(totalPayablesOrig)} total asumido
              </span>
            </div>
          </div>

          {/* Cuadrícula Armónica de Fichas de Acreedores */}
          <div className="loans-harmonious-grid">
            {filteredCreditorGroups.length === 0 ? (
              <div className="clean-card" style={{ width: '100%', textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={40} style={{ opacity: 0.3, marginBottom: '12px', color: 'var(--accent-success)' }} />
                <p style={{ fontWeight: 600 }}>
                  {payablesFilter === 'pending'
                    ? '¡Excelente! No tienes compromisos o deudas pendientes'
                    : payablesFilter === 'paid'
                    ? 'Aún no hay deudas saldadas en el historial'
                    : 'No tienes personas ni deudas registradas'}
                </p>
                <p style={{ fontSize: '0.85rem' }}>
                  {payablesFilter === 'pending'
                    ? 'Todos tus compromisos están al día o saldados.'
                    : 'Usa el botón "+ Registrar Deuda Mía" para registrar un compromiso.'}
                </p>
              </div>
            ) : (
              [filteredCreditorGroups.slice(0, Math.ceil(filteredCreditorGroups.length / 2)), filteredCreditorGroups.slice(Math.ceil(filteredCreditorGroups.length / 2))].map((colGroups, colIdx) => (
                <div key={colIdx} className="loans-col">
                  {colGroups.map(group => {
                const isExpanded = expandedCreditors.has(group.key);
                const initialLetter = group.creditorName ? group.creditorName.charAt(0).toUpperCase() : '?';

                return (
                  <div
                    key={group.key}
                    className={`debtor-group-card ${group.isFullyPaid ? 'fully-paid' : ''}`}
                  >
                    {/* 1. Nivel Superior: Identidad del Acreedor + Saldo Destacado */}
                    <div className="debtor-card-header">
                      <div className="debtor-profile-group">
                        <div className="creditor-avatar" title={`Acreedor: ${group.creditorName}`}>
                          {initialLetter}
                        </div>
                        <div className="debtor-info">
                          <div className="debtor-title-row">
                            <span className="debtor-name" title={group.creditorName}>
                              {group.creditorName}
                            </span>
                            <span
                              className={`badge ${group.isFullyPaid ? 'badge-success' : 'badge-warning'} nowrap`}
                              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                              title={group.isFullyPaid ? 'Compromiso completamente cancelado' : `${group.items.filter(i => (i.remainingAmount ?? (i.totalAmount ?? i.originalAmount)) > 0).length} deudas pendientes por pagar`}
                            >
                              {group.isFullyPaid ? '🟢 Saldada al 100%' : `🟡 ${group.items.filter(i => (i.remainingAmount ?? (i.totalAmount ?? i.originalAmount)) > 0).length} por pagar`}
                            </span>
                            <span className="badge badge-neutral nowrap" style={{ fontSize: '0.7rem' }}>
                              {group.items.length} {group.items.length === 1 ? 'compromiso' : 'compromisos'}
                            </span>
                          </div>
                          <div className="debtor-meta-row">
                            <span className="nowrap" title={`Monto total prestado por ${group.creditorName}: ${formatSoles(group.totalOriginal)}`}>
                              Prestado: <strong style={{ color: 'var(--text-primary)' }}>
                                {group.hasUsd
                                  ? (group.isPureUsd
                                      ? `$ ${group.totalOriginalUsd?.toFixed(2)} USD • ${formatSoles(group.totalOriginal)}`
                                      : `${formatSoles(group.totalOriginal)} • $ ${group.totalOriginalUsd?.toFixed(2)} USD`)
                                  : formatSoles(group.totalOriginal)}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="nowrap" title={`Monto amortizado hasta hoy: ${formatSoles(group.totalPaid)}`}>
                              Pagado: <strong className="text-success">
                                {group.hasUsd
                                  ? (group.isPureUsd
                                      ? `$ ${group.totalPaidUsd?.toFixed(2)} USD • ${formatSoles(group.totalPaid)}`
                                      : `${formatSoles(group.totalPaid)} • $ ${group.totalPaidUsd?.toFixed(2)} USD`)
                                  : formatSoles(group.totalPaid)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Balance Destacado */}
                      <div className="debtor-balance-highlight" title={group.isFullyPaid ? `Total saldado: ${formatSoles(group.totalOriginal)}` : `Monto pendiente por devolver a ${group.creditorName}: ${formatSoles(group.totalRemaining)}`}>
                        <span className="balance-caption nowrap">
                          {group.isFullyPaid ? 'Total Cancelado' : 'Por Devolver'}
                        </span>
                        <span
                          className="balance-amount tabular-nums nowrap"
                          style={{
                            color: group.isFullyPaid ? 'var(--accent-success)' : 'var(--accent-warning)'
                          }}
                        >
                          {group.isFullyPaid
                            ? (group.hasUsd && group.isPureUsd ? `$ ${group.totalOriginalUsd?.toFixed(2)} USD` : formatSoles(group.totalOriginal))
                            : (group.hasUsd && group.isPureUsd ? `$ ${group.totalRemainingUsd?.toFixed(2)} USD` : formatSoles(group.totalRemaining))}
                        </span>
                        {group.hasUsd && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: 500 }}>
                            {group.isPureUsd
                              ? `Equivalente: ${formatSoles(group.isFullyPaid ? group.totalOriginal : group.totalRemaining)}`
                              : `Incluye $ ${(group.isFullyPaid ? group.totalOriginalUsd : group.totalRemainingUsd)?.toFixed(2)} USD`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Nivel Intermedio: Barra de Progreso de Amortización */}
                    <div className="debtor-progress-section" title={`Progreso de amortización: ${group.paidPercentage}% pagado • ${formatSoles(group.totalPaid)} de ${formatSoles(group.totalOriginal)}`}>
                      <div className="debtor-progress-labels">
                        <span>Amortización acumulada</span>
                        <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>
                          {group.paidPercentage}% • {formatSoles(group.totalPaid)} de {formatSoles(group.totalOriginal)}
                        </span>
                      </div>
                      <div className="progress-track" style={{ height: '6px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${group.paidPercentage}%`,
                            background: group.isFullyPaid ? 'var(--accent-success)' : 'var(--accent-warning)'
                          }}
                        />
                      </div>
                    </div>

                    {/* 3. Nivel Inferior: Barra de Acciones y Desglose */}
                    <div className="debtor-actions-toolbar">
                      <div className="debtor-actions-left">
                        {!group.isFullyPaid && (
                          <>
                            <button
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                              onClick={() => handleOpenGroupPayModal(group)}
                              title="Abonar a las deudas de este acreedor en orden de antigüedad"
                            >
                              <Coins size={13} />
                              <span>Abonar</span>
                            </button>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              onClick={() => handleCascadePay(group.creditorName, group.totalRemaining)}
                              title="Pagar la totalidad pendiente a este acreedor"
                            >
                              <span>Pagar Todo</span>
                            </button>
                          </>
                        )}
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                          onClick={() => handleOpenAddLoanForCreditor(group.creditorName)}
                          title={`Registrar otro préstamo que te otorgó ${group.creditorName}`}
                        >
                          <Plus size={13} />
                          <span>Deuda</span>
                        </button>
                      </div>

                      <div className="debtor-actions-right">
                        <button
                          className={`btn-toggle-breakdown ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleCreditorExpanded(group.key)}
                          title={isExpanded ? 'Ocultar desglose detallado' : 'Ver desglose detallado de deudas'}
                        >
                          <span>{isExpanded ? 'Ocultar Detalle' : `Ver Desglose • ${group.items.length}`}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Desglose de Deudas Individuales */}
                    {isExpanded && (
                      <div className="debtor-breakdown-container">
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Desglose de Deudas • {group.items.length}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {group.items.map(item => {
                            const isUsd = item.currency === 'USD';
                            const itemTotal = (isUsd && item.originalAmount) ? item.originalAmount : (item.originalAmount ?? item.totalAmount ?? 0);
                            const itemPaidAmount = item.paidAmount ?? 0;
                            const itemRem = (isUsd && item.remainingAmount > itemTotal) ? Math.max(0, itemTotal - itemPaidAmount) : (item.remainingAmount ?? itemTotal);
                            const itemPaid = itemRem <= 0;

                            return (
                              <div key={item.id} className="breakdown-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                                  <div style={{ flex: 1, minWidth: '160px' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} title={item.description}>
                                      <span>{item.description}</span>
                                      {item.currency === 'USD' && (
                                        <span className="badge badge-neutral nowrap" style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                          USD • TC {item.exchangeRate ? item.exchangeRate.toFixed(4) : FALLBACK_USD_PEN_RATE_STR4}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} title={`Fecha: ${formatDisplayDate(item.createdAt || item.dueDate)}`}>
                                      Fecha: {formatDisplayDate(item.createdAt || item.dueDate)}
                                    </div>
                                    {item.dueDate && !itemPaid && (() => {
                                      const days = Math.ceil((new Date(`${item.dueDate}T12:00:00`).getTime() - Date.now()) / 86400000);
                                      const overdue = days < 0;
                                      const soon = days >= 0 && days <= 5;
                                      const color = overdue ? 'var(--accent-danger)' : soon ? 'var(--accent-warning)' : 'var(--accent-info)';
                                      const label = overdue ? `venció hace ${Math.abs(days)} d` : days === 0 ? 'vence hoy' : `vence en ${days} d`;
                                      return (
                                        <div style={{ fontSize: '0.72rem', color, fontWeight: 600, marginTop: '2px' }} title="Salida programada considerada en el flujo de caja">
                                          📅 Pago programado: {formatDisplayDate(item.dueDate)} • {label}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <div style={{ textAlign: 'right' }} title={`Monto asumido: ${item.currency === 'USD' ? `$ ${itemTotal.toFixed(2)} USD • ${formatSoles(item.amountPen || (itemTotal * (item.exchangeRate || FALLBACK_USD_PEN_RATE)))}` : formatSoles(itemTotal)}`}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Monto</span>
                                      {item.currency === 'USD' ? (
                                        <>
                                          <span className="tabular-nums nowrap" style={{ fontWeight: 600, color: '#38bdf8' }}>$ {itemTotal.toFixed(2)} USD</span>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{formatSoles(item.amountPen || (itemTotal * (item.exchangeRate || FALLBACK_USD_PEN_RATE)))}</span>
                                        </>
                                      ) : (
                                        <span className="tabular-nums nowrap" style={{ fontWeight: 600 }}>{formatSoles(itemTotal)}</span>
                                      )}
                                    </div>
                                    <div style={{ textAlign: 'right' }} title={`Amortizado a la fecha: ${item.currency === 'USD' ? `$ ${(item.paidAmount ?? 0).toFixed(2)} USD` : formatSoles(item.paidAmount ?? 0)}`}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Amortizado</span>
                                      {item.currency === 'USD' ? (
                                        <>
                                          <span className="tabular-nums nowrap" style={{ color: 'var(--accent-success)', fontWeight: 600 }}>$ {(item.paidAmount ?? 0).toFixed(2)} USD</span>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{formatSoles((item.paidAmount ?? 0) * (item.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                                        </>
                                      ) : (
                                        <span className="tabular-nums nowrap" style={{ color: 'var(--accent-success)', fontWeight: 600 }}>{formatSoles(item.paidAmount ?? 0)}</span>
                                      )}
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: '70px' }} title={`Saldo restante por devolver: ${item.currency === 'USD' ? `$ ${itemRem.toFixed(2)} USD` : formatSoles(itemRem)}`}>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Saldo</span>
                                      {item.currency === 'USD' ? (
                                        <>
                                          <span className="tabular-nums nowrap" style={{ fontWeight: 700, color: itemPaid ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                            $ {itemRem.toFixed(2)} USD
                                          </span>
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>{formatSoles(itemRem * (item.exchangeRate || FALLBACK_USD_PEN_RATE))}</span>
                                        </>
                                      ) : (
                                        <span className="tabular-nums nowrap" style={{ fontWeight: 700, color: itemPaid ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                          {formatSoles(itemRem)}
                                        </span>
                                      )}
                                    </div>

                                    <span
                                      className={`badge ${itemPaid ? 'badge-success' : 'badge-warning'} nowrap`}
                                      style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                      title={itemPaid ? 'Deuda cancelada en su totalidad' : 'Deuda pendiente de pago'}
                                    >
                                      {itemPaid ? 'Saldada' : 'Pendiente'}
                                    </span>

                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      {!itemPaid && (
                                        <button
                                          className="btn-primary"
                                          style={{ padding: '4px 9px', fontSize: '0.72rem' }}
                                          onClick={() => handleOpenPayPayable(item)}
                                          title="Abonar a esta deuda específica"
                                        >
                                          <Coins size={12} />
                                          <span>Abonar</span>
                                        </button>
                                      )}
                                      <button
                                        className="btn-action-icon"
                                        onClick={() => handleOpenEditPayable(item)}
                                        title="Editar los datos de esta deuda"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        className="btn-action-icon"
                                        style={{ color: 'var(--accent-danger)' }}
                                        onClick={() => handleDeletePayable(item.id)}
                                        title="Eliminar este compromiso"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* Historial de pagos para esta deuda */}
                                {item.payments && item.payments.length > 0 && (
                                  <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {item.payments.map((pRecord, pIdx) => (
                                      <div key={pRecord.id || pIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }} title={`Abono de ${isUsd ? `$ ${pRecord.amount.toFixed(2)} USD` : formatSoles(pRecord.amount)} realizado el ${formatDisplayDate(pRecord.paymentDate)}`}>
                                        <span>• {formatDisplayDate(pRecord.paymentDate)} {pRecord.notes ? `• ${pRecord.notes}` : ''}</span>
                                        <span className="tabular-nums font-semibold" style={{ color: 'var(--accent-danger)' }}>
                                          -{isUsd ? `$ ${pRecord.amount.toFixed(2)} USD` : formatSoles(pRecord.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}

    </div>
  );
};
