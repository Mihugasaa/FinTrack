'use client';

import React from 'react';
import { X, CreditCard, TrendingUp, Sparkles, Camera, Banknote, DollarSign, Repeat, Wallet, Tag } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { CustomDatePicker } from '@/components/CustomDatePicker';
import { AIIntelligenceService } from '@/services/aiIntelligence.service';
import { CurrencyCode } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';

export const ExpenseModal: React.FC = () => {
  const {
    setIsExpenseModalOpen,
    handleCreateTransaction,
    editingTransactionId,
    isRefundMode,
    setIsRefundMode,
    isInstallment,
    setIsInstallment,
    modalNaturalText,
    setModalNaturalText,
    isParsingNaturalExpense,
    handleParseNaturalExpense,
    handleScanReceiptFile,
    isScanningReceipt,
    scanReceiptError,
    desc,
    setDesc,
    aiSuggestion,
    setAiSuggestion,
    selectedCategoryId,
    setSelectedCategoryId,
    isRecurring,
    setIsRecurring,
    amount,
    setAmount,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    tcInfo,
    isFetchingTc,
    setHasUserManuallyEditedTc,
    fetchSunatRate,
    selectedMethodId,
    setSelectedMethodId,
    paymentMethods,
    categories,
    txDate,
    setTxDate,
    installmentsCount,
    setInstallmentsCount,
    hasInterest,
    setHasInterest,
    monthlyInstallmentAmount,
    setMonthlyInstallmentAmount,
    overrideDueDate,
    setOverrideDueDate,
    modalCalculatedDueDate,
    modalDueDateDetail,
    isSubmittingExpense,
    formatDisplayDate,
    formatSoles,
    handleBackdropMouseDown,
    handleBackdropClick
  } = useFinance();
  const onClose = () => setIsExpenseModalOpen(false);
  const onSubmit = handleCreateTransaction;
  const { modalBoxRef, dragHandleProps } = useSwipeToDismiss({ onClose });

  return (
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick(onClose)}
      onTouchMove={e => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      <div className="modal-box" ref={modalBoxRef} onClick={e => e.stopPropagation()}>
        <div className="modal-drag-zone" {...dragHandleProps}>
          <div className="modal-drag-handle" />
        </div>
        <div className="modal-title-row">
          <span className="text-h2 font-bold">
            {editingTransactionId ? 'Modificar Movimiento' : (isRefundMode ? 'Registrar Reembolso' : 'Nuevo Movimiento')}
          </span>
          <button id="btn-close-expense-modal" className="month-nav-btn modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {!editingTransactionId && (
          <div className="segment-tabs-nav" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={`segment-tab-btn ${!isRefundMode ? 'active' : ''}`}
              onClick={() => setIsRefundMode(false)}
            >
              <CreditCard size={14} />
              <span>Gasto</span>
            </button>
            <button
              type="button"
              className={`segment-tab-btn ${isRefundMode ? 'active' : ''}`}
              onClick={() => {
                setIsRefundMode(true);
                setIsInstallment(false);
              }}
            >
              <TrendingUp size={14} />
              <span>Reembolso / Abono</span>
            </button>
          </div>
        )}

        {isRefundMode && (
          <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '14px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            🟢 Reduce la deuda en tarjetas de crédito o suma saldo a favor en cuentas de débito.
          </div>
        )}

        {!editingTransactionId && !isRefundMode && (
          <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Autocompletado por lenguaje natural dentro del modal */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                id="input-modal-natural-expense"
                type="text"
                placeholder="Ej: Almuerzo S/ 35 ayer con BCP..."
                value={modalNaturalText}
                onChange={e => setModalNaturalText(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (modalNaturalText.trim() && !isParsingNaturalExpense) {
                      const t = modalNaturalText;
                      setModalNaturalText('');
                      await handleParseNaturalExpense(t);
                    }
                  }
                }}
                disabled={isParsingNaturalExpense}
                style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1.5px solid var(--border-medium)',
                  borderRadius: '8px',
                  padding: '8px 11px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                id="btn-modal-natural-parse"
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  if (modalNaturalText.trim() && !isParsingNaturalExpense) {
                    const t = modalNaturalText;
                    setModalNaturalText('');
                    await handleParseNaturalExpense(t);
                  }
                }}
                disabled={isParsingNaturalExpense || !modalNaturalText.trim()}
                style={{ padding: '7px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Sparkles size={13} color="var(--accent-brand)" />
                <span>{isParsingNaturalExpense ? 'Completando...' : 'Autocompletar'}</span>
              </button>
            </div>

            <input
              type="file"
              id="receipt-file-input"
              accept="image/png,image/jpeg,image/webp,image/heic"
              style={{ display: 'none' }}
              onChange={handleScanReceiptFile}
            />
            <button
              type="button"
              id="btn-scan-receipt"
              className="btn-secondary"
              style={{
                width: '100%',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: 'var(--bg-subtle)',
                border: '1px dashed var(--border-focus)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                cursor: isScanningReceipt ? 'wait' : 'pointer'
              }}
              disabled={isScanningReceipt}
              onClick={() => document.getElementById('receipt-file-input')?.click()}
            >
              <Camera size={15} color="var(--accent-brand)" />
              {isScanningReceipt ? (
                <span>Extrayendo datos del comprobante...</span>
              ) : (
                <span>Escanear comprobante</span>
              )}
              <span className="reconciliation-ai-chip" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.68rem' }}>
                <Sparkles size={11} /> Inteligente
              </span>
            </button>
            {scanReceiptError && (
              <p style={{ margin: '6px 0 0 0', fontSize: '0.74rem', color: 'var(--accent-danger)' }}>
                {scanReceiptError}
              </p>
            )}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input
              id="input-expense-desc"
              type="text"
              placeholder={isRefundMode ? "ej. Reembolso Steam, Devolución Amazon, Abono Cashback" : "ej. Almuerzo, Uber, Netflix, Wong, Inkafarma"}
              className="form-input"
              required
              value={desc}
              onChange={e => {
                const val = e.target.value;
                setDesc(val);
                if (!isRefundMode) {
                  const prediction = AIIntelligenceService.predictCategory(val, categories);
                  if (prediction) {
                    setAiSuggestion(prediction);
                    setSelectedCategoryId(prediction.categoryId);
                    if (prediction.isFixedSuggestion) {
                      setIsRecurring(true);
                    }
                  } else {
                    setAiSuggestion(null);
                  }
                }
              }}
            />
            {!isRefundMode && aiSuggestion && (
              <div
                className="ai-suggest-chip"
                onClick={() => {
                  setSelectedCategoryId(aiSuggestion.categoryId);
                  if (aiSuggestion.isFixedSuggestion) setIsRecurring(true);
                }}
                title="Clic para aplicar categoría sugerida"
              >
                <Sparkles size={13} />
                <span>Sugerencia: <strong>{aiSuggestion.categoryName}</strong></span>
                {aiSuggestion.isFixedSuggestion && <span>• 📌 Fijo</span>}
              </div>
            )}
          </div>

          <div className="form-row-amount-currency">
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input
                id="input-expense-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="form-input"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Moneda</label>
              <CustomSelect
                id="select-expense-currency"
                value={currency}
                onChange={val => {
                  const cur = val as CurrencyCode;
                  setCurrency(cur);
                  if (cur === 'USD') {
                    fetchSunatRate(txDate, true);
                  }
                }}
                options={[
                  { value: 'PEN', label: 'Soles • PEN', icon: <Banknote size={15} style={{ color: '#10b981' }} /> },
                  { value: 'USD', label: 'Dólares • USD', icon: <DollarSign size={15} style={{ color: '#0ea5e9' }} /> },
                ]}
              />
            </div>
          </div>

          {currency === 'USD' && (
            <div style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginTop: '10px',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={15} style={{ color: 'var(--accent-success)' }} />
                  Tipo de cambio • USD a PEN
                </label>
                {tcInfo && (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      background: tcInfo.isFallback ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: tcInfo.isFallback ? 'var(--accent-warning)' : 'var(--accent-success)',
                      border: tcInfo.isFallback ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🏛️ {tcInfo.source} • {tcInfo.date}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    id="input-expense-exchange-rate"
                    type="number"
                    step="0.0001"
                    className="form-input"
                    style={{ paddingRight: '40px' }}
                    value={exchangeRate}
                    onChange={e => {
                      setExchangeRate(e.target.value);
                      setHasUserManuallyEditedTc(true);
                    }}
                    placeholder="3.3620"
                  />
                  {isFetchingTc && (
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.72rem',
                      color: 'var(--accent-info)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Sparkles size={13} className="spin-slow" />
                    </div>
                  )}
                </div>
                <button
                  id="btn-fetch-sunat"
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setHasUserManuallyEditedTc(false);
                    fetchSunatRate(txDate, true);
                  }}
                  title="Consultar y aplicar cotización oficial de SUNAT para esta fecha"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Repeat size={13} />
                  SUNAT
                </button>
              </div>

              {/* Detalle informativo de conversión en tiempo real */}
              <div style={{ marginTop: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {amount && !isNaN(parseFloat(amount)) && !isNaN(parseFloat(exchangeRate)) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-success)', fontWeight: 600 }}>
                    <span>💵 Equivale a:</span>
                    <span style={{ fontSize: '0.85rem' }}>
                      S/ {(parseFloat(amount) * parseFloat(exchangeRate)).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      • ${parseFloat(amount).toFixed(2)} × {parseFloat(exchangeRate).toFixed(4)}
                    </span>
                  </div>
                )}
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {tcInfo?.buyRate && tcInfo?.sellRate ? (
                    <span>
                      SUNAT {tcInfo.date}: Venta <strong>S/ {tcInfo.sellRate.toFixed(3)}</strong> | Compra <strong>S/ {tcInfo.buyRate.toFixed(3)}</strong>. Puedes modificarlo si tu banco aplicó otra tasa.
                    </span>
                  ) : (
                    <span>
                      Cotización oficial SUNAT/SBS. Puedes modificarla si tu banco aplicó otra tasa.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">{isRefundMode ? 'Tarjeta / Cuenta a Abonar' : 'Medio de Pago'}</label>
              <CustomSelect
                id="select-expense-payment-method"
                value={selectedMethodId}
                onChange={val => setSelectedMethodId(val)}
                options={paymentMethods.map(p => ({
                  value: p.id,
                  label: p.name,
                  subtitle: p.type === 'credit' ? 'Tarjeta de Crédito' : 'Débito / Efectivo',
                  colorDot: p.color || (p.type === 'credit' ? '#6366f1' : '#10b981'),
                  icon: p.type === 'credit' ? <CreditCard size={15} /> : <Wallet size={15} />
                }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Categoría</label>
              <CustomSelect
                id="select-expense-category"
                value={selectedCategoryId}
                onChange={val => setSelectedCategoryId(val)}
                options={categories.map(c => ({
                  value: c.id,
                  label: c.name,
                  colorDot: c.color || '#8b5cf6',
                  icon: <Tag size={14} style={{ color: c.color || 'var(--text-muted)' }} />
                }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{isRefundMode ? 'Fecha del Reembolso' : 'Fecha de Compra'}</label>
            <CustomDatePicker
              id="input-expense-date"
              value={txDate}
              onChange={(newDate) => {
                setTxDate(newDate);
                if (currency === 'USD') {
                  fetchSunatRate(newDate, true);
                }
              }}
            />
          </div>

          {!isRefundMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-glass)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                marginTop: '10px',
                marginBottom: '12px',
                cursor: 'pointer'
              }}
              onClick={() => setIsRecurring(prev => !prev)}
            >
              <input
                type="checkbox"
                id="isRecurringCheck"
                checked={isRecurring}
                onChange={e => {
                  e.stopPropagation();
                  setIsRecurring(e.target.checked);
                }}
                onClick={e => e.stopPropagation()}
                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                <label
                  htmlFor="isRecurringCheck"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', color: 'var(--text-primary)', margin: 0 }}
                >
                  <strong>Gasto recurrente mensual</strong>
                </label>
                <span className="modal-footnote-note">
                  Se proyectará cada mes en tu presupuesto y flujo de caja.
                </span>
              </div>
            </div>
          )}

          {/* Sección de Compras en Cuotas (Solo para Tarjetas de Crédito y en Nuevos Gastos) */}
          {(() => {
            const selectedPm = paymentMethods.find(p => p.id === selectedMethodId);
            if (selectedPm?.type === 'credit' && !isRefundMode && !editingTransactionId) {
              return (
                <div className="installment-section-box">
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    onClick={() => setIsInstallment(prev => !prev)}
                  >
                    <input
                      type="checkbox"
                      id="checkIsInstallment"
                      checked={isInstallment}
                      onChange={e => {
                        e.stopPropagation();
                        setIsInstallment(e.target.checked);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="checkIsInstallment" onClick={e => e.stopPropagation()} style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      💳 Pagar en cuotas
                    </label>
                  </div>

                  {isInstallment && (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>Número de Cuotas</label>
                          <select
                            className="form-input"
                            value={installmentsCount}
                            onChange={e => setInstallmentsCount(e.target.value)}
                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                          >
                            {[2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36].map(n => (
                              <option key={n} value={n}>{n} cuotas mensuales</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>Modalidad</label>
                          <select
                            className="form-input"
                            value={hasInterest ? 'with' : 'without'}
                            onChange={e => setHasInterest(e.target.value === 'with')}
                            style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                          >
                            <option value="without">0% Sin Intereses</option>
                            <option value="with">Con Intereses</option>
                          </select>
                        </div>
                      </div>

                      {hasInterest && (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.78rem' }}>Monto de cada cuota (S/)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            placeholder={`ej. ${(parseFloat(amount || '0') / (parseInt(installmentsCount, 10) || 1) * 1.05).toFixed(2)}`}
                            value={monthlyInstallmentAmount}
                            onChange={e => setMonthlyInstallmentAmount(e.target.value)}
                          />
                        </div>
                      )}

                      <div style={{ padding: '8px 10px', background: 'rgba(99, 102, 241, 0.08)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ✨ <strong>{installmentsCount} cuotas estimadas de{' '}
                        {formatSoles(
                          hasInterest && monthlyInstallmentAmount
                            ? parseFloat(monthlyInstallmentAmount)
                            : (parseFloat(amount || '0') / (parseInt(installmentsCount, 10) || 1)) * (currency === 'USD' ? parseFloat(exchangeRate || '1') : 1)
                        )} al mes</strong>, según el ciclo de tu tarjeta.
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()}

          {(() => {
            const selectedPm = paymentMethods.find(p => p.id === selectedMethodId);
            if (isRefundMode) {
              if (selectedPm?.type === 'credit') {
                return (
                  <div style={{ marginTop: '10px', background: 'rgba(99, 102, 241, 0.05)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-brand)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CreditCard size={15} /> Abono a Tarjeta de Crédito
                      </span>
                      <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>Disminuye Deuda</span>
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                      Este reembolso se computará a favor en <strong>{selectedPm.name}</strong> con fecha <strong>{formatDisplayDate(txDate)}</strong>, reduciendo el saldo que adeudas al banco en este ciclo.
                    </p>
                  </div>
                );
              }
              return (
                <div style={{ marginTop: '10px', background: 'rgba(16, 185, 129, 0.05)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wallet size={15} /> Abono a Cuenta Débito / Efectivo
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>Aumenta Saldo</span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    Este reembolso ingresará directamente a <strong>{selectedPm?.name || 'tu cuenta'}</strong> con fecha <strong>{formatDisplayDate(txDate)}</strong>, incrementando de inmediato tu liquidez disponible.
                  </p>
                </div>
              );
            }

            if (selectedPm?.type === 'credit') {
              return (
                <div style={{ marginTop: '10px', background: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>Fecha de pago estimada</label>
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Crédito</span>
                  </div>
                  <CustomDatePicker
                    value={overrideDueDate || modalCalculatedDueDate}
                    onChange={setOverrideDueDate}
                    title="Puedes ajustar la fecha si tu banco la trasladó por feriado o fin de semana"
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {modalDueDateDetail.wasAdjusted ? (
                      <span style={{ color: 'var(--accent-info)', display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <Sparkles size={12} /> <strong>Ajustado a día hábil:</strong> Vencía {modalDueDateDetail.originalDayOfWeek ? modalDueDateDetail.originalDayOfWeek.toLowerCase() : ''} {formatDisplayDate(modalDueDateDetail.nominalDueDate)}, trasladado al <strong>{formatDisplayDate(modalDueDateDetail.dueDate)}</strong> por feriado o fin de semana.
                      </span>
                    ) : (
                      <span>
                        📅 Vencimiento según tu ciclo: <strong>{formatDisplayDate(modalCalculatedDueDate)}</strong>. Puedes ajustarlo si tu banco asignó otra fecha.
                      </span>
                    )}
                    {modalDueDateDetail.closeWasAdjusted && modalDueDateDetail.belongsToNextCycle && (
                      <div style={{ color: 'var(--accent-success)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <Sparkles size={12} /> <strong>Corte adelantado al {modalDueDateDetail.closeOriginalDayOfWeek ? modalDueDateDetail.closeOriginalDayOfWeek.toLowerCase() : ''} {formatDisplayDate(modalDueDateDetail.effectiveCloseDate)}</strong> por fin de semana. Esta compra ingresa al siguiente ciclo de facturación.
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="modal-due-date-preview">
                <span className="text-muted">Fecha de cargo:</span>
                <span style={{ color: 'var(--accent-success)', fontWeight: 700 }}>
                  {formatDisplayDate(txDate)} • Cargo inmediato
                </span>
              </div>
            );
          })()}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              id="btn-save-expense"
              type="submit"
              className="btn-primary"
              disabled={isSubmittingExpense}
            >
              {isSubmittingExpense
                ? 'Guardando...'
                : (editingTransactionId
                    ? 'Guardar Cambios'
                    : (isRefundMode
                        ? 'Registrar Reembolso'
                        : (isInstallment ? `Crear Plan (${installmentsCount} Cuotas)` : 'Guardar Gasto')))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
