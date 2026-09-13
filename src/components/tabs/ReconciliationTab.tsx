'use client';

import React from 'react';
import { CheckCheck, Sparkles, UploadCloud, Plus } from 'lucide-react';
import { ReconciliationSummary, ReconciliationItem, PaymentMethod } from '@/types';
import { useFinance } from '@/contexts/FinanceContext';

interface ReconciliationTabProps {
  handleLoadDemoStatement: () => void;
  handleStatementFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  statementFileName: string;
  isParsingStatement: boolean;
  reconciliationSummary: ReconciliationSummary | null;
  reconciliationFilter: 'all' | 'matched' | 'unmatched_app' | 'mismatch';
  setReconciliationFilter: (f: 'all' | 'matched' | 'unmatched_app' | 'mismatch') => void;
  setReconciliationSummary: (s: ReconciliationSummary | null) => void;
  setStatementFileName: (n: string) => void;
  currentMonthTransactionsCount: number;
  creditCards?: PaymentMethod[];
  handleImportStatementItem: (item: ReconciliationItem) => void;
  handleImportAllUnmatched?: () => void;
  formatDisplayDate: (d: string | undefined, fallback?: string) => string;
  formatSoles: (val: number) => string;
}

export const ReconciliationTab: React.FC = () => {
  const {
    handleLoadDemoStatement,
    handleStatementFileUpload,
    statementFileName,
    isParsingStatement,
    reconciliationSummary,
    reconciliationFilter,
    setReconciliationFilter,
    setReconciliationSummary,
    setStatementFileName,
    currentMonthTransactions,
    paymentMethods,
    handleImportStatementItem,
    handleImportAllUnmatched,
    formatDisplayDate,
    formatSoles
  } = useFinance();
  // Derivados locales (antes calculados por el padre y pasados como props)
  const currentMonthTransactionsCount = currentMonthTransactions.length;
  const creditCards = paymentMethods.filter(pm => pm.type === 'credit' && pm.isActive);
  // Filtrar elementos de auditoría según filtro activo
  const filteredItems = (reconciliationSummary?.items || []).filter(item => {
    if (reconciliationFilter === 'matched') return item.status === 'matched';
    if (reconciliationFilter === 'unmatched_app') return item.status === 'unmatched_in_app';
    if (reconciliationFilter === 'mismatch') return item.status === 'amount_mismatch';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Conciliación Inteligente */}
      <div
        className="analytics-section-title"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 className="panel-header-title" style={{ margin: 0 }}>
              Conciliación Bancaria Inteligente
            </h2>
            <span className="reconciliation-ai-chip">
              <Sparkles size={11} /> Motor Inteligente
            </span>
          </div>
          <p className="panel-header-subtitle" style={{ margin: 0 }}>
            Audita y contrasta tus extractos de cuenta bancarios para asegurar que ningún gasto quede sin registrar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            id="btn-load-demo-statement"
            className="btn-primary"
            onClick={handleLoadDemoStatement}
            title="Cargar extracto de prueba para ver el funcionamiento inmediato"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Sparkles size={14} />
            <span>Cargar Demo BCP</span>
          </button>
        </div>
      </div>

      {/* Input de archivo oculto compartido */}
      <input
        id="input-statement-file"
        type="file"
        accept=".pdf, .xlsx, .xls, .csv"
        style={{ display: 'none' }}
        onChange={handleStatementFileUpload}
      />

      {/* Si hay archivo cargado: Barra compacta ejecutiva. Si no: Dropzone expandido */}
      {reconciliationSummary ? (
        <div className="reconciliation-file-bar">
          <div className="reconciliation-file-info">
            <div className="reconciliation-file-icon">
              <CheckCheck size={20} />
            </div>
            <div>
              <div className="reconciliation-file-name">
                {statementFileName || 'Extracto BCP Mayo 2026.xlsx'}
              </div>
              <div className="reconciliation-file-meta">
                <span>Auditoría BCP / FinTrack completada</span>
                <span>•</span>
                <span className="tabular-nums font-bold">
                  {reconciliationSummary.items.length} movimientos procesados
                </span>
              </div>
            </div>
          </div>
          <div className="reconciliation-file-actions">
            <button
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => document.getElementById('input-statement-file')?.click()}
            >
              <UploadCloud size={13} style={{ marginRight: '5px' }} /> Cambiar archivo
            </button>
            <button
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={() => {
                setReconciliationSummary(null);
                setStatementFileName('');
              }}
            >
              Limpiar Auditoría
            </button>
          </div>
        </div>
      ) : (
        <div
          className="reconciliation-dropzone"
          onClick={() => document.getElementById('input-statement-file')?.click()}
        >
          <UploadCloud size={36} color="var(--accent-brand)" />
          {creditCards && creditCards.length > 0 ? (
            <div className="reconciliation-banks-pills">
              {creditCards.map(card => {
                const cleanBank = card.name
                  .replace(/^TC\s+/i, '')
                  .replace(/\s*\(.*\)/, '')
                  .trim()
                  .toUpperCase();
                return (
                  <span key={card.id} className="reconciliation-bank-chip">
                    {cleanBank || card.name.toUpperCase()}
                  </span>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                maxWidth: '520px',
                lineHeight: 1.4
              }}
            >
              No tienes tarjetas de crédito registradas en FinTrack. Puedes agregar una en la pestaña <strong>Tarjetas & Cuentas</strong> o subir el extracto de cualquier entidad bancaria para conciliar.
            </div>
          )}
          <div>
            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              Arrastra tu Estado de Cuenta en PDF, Excel o CSV o haz clic para examinar
            </strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Compatible con estados de cuenta en PDF de BCP, BBVA, Interbank y Scotiabank mediante IA Gemini, así como planillas Excel y CSV.
            </p>
          </div>
          {isParsingStatement && (
            <span className="reconciliation-ai-chip">
              <Sparkles size={12} /> Procesando y auditando con IA...
            </span>
          )}
        </div>
      )}

      {/* Panel Principal de Resultados si hay auditoría calculada */}
      {reconciliationSummary && (
        <div>
          {/* 4 Macro KPIs Grid con Hero Radial Gauge */}
          <div id="reconciliation-kpis" className="reconciliation-kpis-grid">
            {/* Card 1: Hero Radial Gauge */}
            <div
              className={`reconciliation-gauge-card ${
                reconciliationSummary.matchPercentage === 100 ? 'is-complete' : ''
              }`}
            >
              <div className="reconciliation-gauge-wrapper">
                <svg className="reconciliation-gauge-svg" viewBox="0 0 80 80">
                  <circle className="reconciliation-gauge-bg" cx="40" cy="40" r="35" />
                  <circle
                    className={`reconciliation-gauge-progress ${
                      reconciliationSummary.matchPercentage === 100 ? 'is-complete' : ''
                    }`}
                    cx="40"
                    cy="40"
                    r="35"
                    style={{
                      strokeDashoffset:
                        220 -
                        Math.round(
                          (220 * Math.min(100, Math.max(0, reconciliationSummary.matchPercentage))) / 100
                        )
                    }}
                  />
                </svg>
                <div className="reconciliation-gauge-center tabular-nums">
                  {reconciliationSummary.matchPercentage}%
                </div>
              </div>
              <div className="reconciliation-gauge-content">
                <div className="reconciliation-gauge-label">Nivel de Coincidencia</div>
                <div
                  className={`reconciliation-gauge-status ${
                    reconciliationSummary.matchPercentage === 100 ? 'is-complete' : ''
                  }`}
                >
                  {reconciliationSummary.unmatchedInAppCount === 0
                    ? 'Cuadre Completo'
                    : `${reconciliationSummary.unmatchedInAppCount} Faltantes`}
                </div>
                <div className="reconciliation-gauge-sub tabular-nums">
                  {reconciliationSummary.matchedCount} de{' '}
                  {reconciliationSummary.items.filter(i => i.statementTx).length} verificadas
                </div>
              </div>
            </div>

            {/* Card 2: Extracto Bancario */}
            <div className="reconciliation-kpi-card kpi-bank">
              <div className="reconciliation-kpi-header">
                <span className="reconciliation-kpi-label">Extracto Bancario</span>
                <span className="reconciliation-kpi-tag tag-bank">Banco</span>
              </div>
              <div className="reconciliation-kpi-value tabular-nums font-bold">
                {formatSoles(reconciliationSummary.totalStatementAmount)}
              </div>
              <div className="reconciliation-kpi-sub tabular-nums">
                {reconciliationSummary.items.filter(i => i.statementTx).length} cargos facturados
              </div>
            </div>

            {/* Card 3: Registrado en FinTrack */}
            <div className="reconciliation-kpi-card kpi-app">
              <div className="reconciliation-kpi-header">
                <span className="reconciliation-kpi-label">Registrado en FinTrack</span>
                <span className="reconciliation-kpi-tag tag-app">FinTrack</span>
              </div>
              <div className="reconciliation-kpi-value tabular-nums font-bold">
                {formatSoles(reconciliationSummary.totalAppAmount)}
              </div>
              <div className="reconciliation-kpi-sub tabular-nums">
                {currentMonthTransactionsCount} gastos del mes
              </div>
            </div>

            {/* Card 4: Diferencia por Aclarar */}
            <div
              className={`reconciliation-kpi-card ${
                Math.abs(reconciliationSummary.netDifference) < 1 ? 'kpi-diff-ok' : 'kpi-diff-bad'
              }`}
            >
              <div className="reconciliation-kpi-header">
                <span className="reconciliation-kpi-label">Diferencia por Aclarar</span>
                <span
                  className={`reconciliation-kpi-tag ${
                    Math.abs(reconciliationSummary.netDifference) < 1 ? 'tag-diff-ok' : 'tag-diff-bad'
                  }`}
                >
                  {Math.abs(reconciliationSummary.netDifference) < 1 ? 'Cuadrado' : 'Revisar'}
                </span>
              </div>
              <div
                className="reconciliation-kpi-value tabular-nums font-bold"
                style={{
                  color:
                    Math.abs(reconciliationSummary.netDifference) < 1
                      ? 'var(--accent-success)'
                      : 'var(--accent-danger)'
                }}
              >
                {formatSoles(reconciliationSummary.netDifference)}
              </div>
              <div className="reconciliation-kpi-sub tabular-nums">
                {reconciliationSummary.unmatchedInAppCount} pendientes por registrar
              </div>
            </div>
          </div>

          {/* Barra de Filtros Segmentada Zen (Zero Paréntesis) */}
          <div className="reconciliation-control-bar">
            <div className="reconciliation-segmented-group">
              <button
                className={`reconciliation-segmented-btn ${reconciliationFilter === 'all' ? 'active' : ''}`}
                onClick={() => setReconciliationFilter('all')}
              >
                <span>Todos</span>
                <span className="reconciliation-micro-pill tabular-nums">
                  {reconciliationSummary.items.length}
                </span>
              </button>
              <button
                className={`reconciliation-segmented-btn ${reconciliationFilter === 'matched' ? 'active' : ''}`}
                onClick={() => setReconciliationFilter('matched')}
              >
                <span>🟢 Conciliados</span>
                <span className="reconciliation-micro-pill tabular-nums">
                  {reconciliationSummary.matchedCount}
                </span>
              </button>
              <button
                className={`reconciliation-segmented-btn ${
                  reconciliationFilter === 'unmatched_app' ? 'active' : ''
                }`}
                onClick={() => setReconciliationFilter('unmatched_app')}
              >
                <span>🟡 Faltantes en App</span>
                <span
                  className={`reconciliation-micro-pill tabular-nums ${
                    reconciliationSummary.unmatchedInAppCount > 0 ? 'pill-warning' : ''
                  }`}
                >
                  {reconciliationSummary.unmatchedInAppCount}
                </span>
              </button>
              <button
                className={`reconciliation-segmented-btn ${
                  reconciliationFilter === 'mismatch' ? 'active' : ''
                }`}
                onClick={() => setReconciliationFilter('mismatch')}
              >
                <span>🔴 Discrepancias</span>
                <span className="reconciliation-micro-pill tabular-nums">
                  {reconciliationSummary.mismatchCount}
                </span>
              </button>
            </div>

            <div className="reconciliation-control-actions">
              {reconciliationSummary.unmatchedInAppCount > 0 && handleImportAllUnmatched && (
                <button
                  className="btn-bulk-import"
                  onClick={handleImportAllUnmatched}
                  title="Registrar automáticamente todas las compras faltantes en FinTrack"
                >
                  <Plus size={14} />
                  <span>Importar Todos los Faltantes</span>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '0.72rem'
                    }}
                  >
                    {reconciliationSummary.unmatchedInAppCount}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Vista Escritorio: Tabla Zen Limpia */}
          <div className="reconciliation-desktop-table clean-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th style={{ width: '140px', whiteSpace: 'nowrap' }}>Estado</th>
                    <th style={{ width: '95px', whiteSpace: 'nowrap' }}>Fecha Banco</th>
                    <th style={{ minWidth: '220px' }}>Concepto en Estado de Cuenta</th>
                    <th className="text-right" style={{ width: '120px', whiteSpace: 'nowrap' }}>
                      Monto Banco
                    </th>
                    <th style={{ minWidth: '180px', whiteSpace: 'nowrap' }}>Registro en FinTrack</th>
                    <th style={{ width: '150px', whiteSpace: 'nowrap' }}>Categoría Sugerida</th>
                    <th className="text-right" style={{ width: '100px', whiteSpace: 'nowrap' }}>
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id} className="reconciliation-row">
                      <td>
                        {item.status === 'matched' && (
                          <span className="status-badge-matched">🟢 Conciliado</span>
                        )}
                        {item.status === 'unmatched_in_app' && (
                          <span className="status-badge-unmatched">🟡 Faltante en App</span>
                        )}
                        {item.status === 'unmatched_in_bank' && (
                          <span className="status-badge-apponly">Solo en App</span>
                        )}
                        {item.status === 'amount_mismatch' && (
                          <span className="status-badge-mismatch">🔴 Discrepancia</span>
                        )}
                      </td>
                      <td className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                        {formatDisplayDate(item.statementTx?.date || item.appTx?.date, '—')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.statementTx?.description || item.appTx?.description || '—'}
                        </span>
                        {item.notes && (
                          <div
                            style={{
                              fontSize: '0.725rem',
                              color: 'var(--text-muted)',
                              marginTop: '2px'
                            }}
                          >
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="tabular-nums text-right font-bold" style={{ whiteSpace: 'nowrap' }}>
                        {item.statementTx ? formatSoles(item.statementTx.amount) : '—'}
                      </td>
                      <td>
                        {item.appTx ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {item.appTx.description}
                            </span>
                            <span
                              className="tabular-nums font-bold"
                              style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                            >
                              {formatSoles(item.appTx.amountPen)}
                            </span>
                          </div>
                        ) : (
                          <span
                            style={{
                              color: 'var(--accent-warning)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            No registrado
                          </span>
                        )}
                      </td>
                      <td>
                        {item.suggestedCategory ? (
                          <span className="reconciliation-ai-chip">
                            <Sparkles size={11} /> {item.suggestedCategory}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        {item.status === 'unmatched_in_app' && (
                          <button
                            className="btn-reconciliation-add"
                            onClick={() => handleImportStatementItem(item)}
                            title="Crear transacción en FinTrack con 1 Clic"
                          >
                            <Plus size={12} />
                            <span>Agregar</span>
                          </button>
                        )}
                        {item.status === 'matched' && (
                          <span
                            style={{
                              color: 'var(--accent-success)',
                              fontSize: '0.78rem',
                              fontWeight: 700
                            }}
                          >
                            ✓ Verificado
                          </span>
                        )}
                        {item.status === 'amount_mismatch' && (
                          <span
                            style={{
                              color: 'var(--accent-danger)',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}
                          >
                            Revisar
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vista Móvil: Tarjetas Táctiles (< 768px) */}
          <div className="reconciliation-mobile-cards-list">
            {filteredItems.map(item => (
              <div key={item.id} className="reconciliation-mobile-card">
                <div className="reconciliation-mobile-card-top">
                  <div>
                    {item.status === 'matched' && (
                      <span className="status-badge-matched">🟢 Conciliado</span>
                    )}
                    {item.status === 'unmatched_in_app' && (
                      <span className="status-badge-unmatched">🟡 Faltante en App</span>
                    )}
                    {item.status === 'unmatched_in_bank' && (
                      <span className="status-badge-apponly">Solo en App</span>
                    )}
                    {item.status === 'amount_mismatch' && (
                      <span className="status-badge-mismatch">🔴 Discrepancia</span>
                    )}
                  </div>
                  <span
                    className="text-caption text-muted tabular-nums"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {formatDisplayDate(item.statementTx?.date || item.appTx?.date, '—')}
                  </span>
                </div>

                <div className="reconciliation-mobile-card-body">
                  <span className="reconciliation-mobile-card-title">
                    {item.statementTx?.description || item.appTx?.description || '—'}
                  </span>
                  <span className="reconciliation-mobile-card-amount tabular-nums">
                    {item.statementTx
                      ? formatSoles(item.statementTx.amount)
                      : formatSoles(item.appTx?.amountPen || 0)}
                  </span>
                </div>

                {item.notes && (
                  <div className="reconciliation-mobile-card-sub">
                    {item.notes}
                  </div>
                )}

                <div className="reconciliation-mobile-card-footer">
                  <div>
                    {item.suggestedCategory && (
                      <span className="reconciliation-ai-chip">
                        <Sparkles size={11} /> {item.suggestedCategory}
                      </span>
                    )}
                  </div>
                  <div>
                    {item.status === 'unmatched_in_app' && (
                      <button
                        className="btn-reconciliation-add"
                        onClick={() => handleImportStatementItem(item)}
                      >
                        <Plus size={12} />
                        <span>Agregar</span>
                      </button>
                    )}
                    {item.status === 'matched' && (
                      <span
                        style={{
                          color: 'var(--accent-success)',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}
                      >
                        ✓ Verificado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
