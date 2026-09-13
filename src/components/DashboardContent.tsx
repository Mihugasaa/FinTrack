'use client';

import { useFinance } from '@/contexts/FinanceContext';
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

export function DashboardContent() {
  const {
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
    setInitialDebitBalances,
    initialDebitForMonth,
    tempDebitBalance,
    setTempDebitBalance,
    handleAdjustDebit,
    // Medios de pago y categorías
    paymentMethods,
    categories,
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
    editCardName,
    setEditCardName,
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
    editingTransactionId,
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
    promptDeleteTransaction,
    // Ingresos
    salaries,
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
    handleSaveSalary,
    // Abonos a tarjetas
    cardPayments,
    currentMonthCardPayments,
    isPaymentModalOpen,
    paymentSourceType,
    setPaymentSourceType,
    paymentCardId,
    setPaymentCardId,
    paymentAmount,
    setPaymentAmount,
    paymentDate,
    setPaymentDate,
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
    handleSaveCollect,
    handleOpenAddLoanForDebtor,
    toggleDebtorExpanded,
    handleCreateReceivable,
    // Mis deudas
    payables,
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
    combinedMovements,
    monthMovementsTotal,
    todayDividerIndex,
    // Helpers de formato / resolución
    resolvePaymentMethod,
    formatDisplayDate,
    formatSoles,
    renderTodayDividerRow,
    renderTodayDividerMobile
  } = useFinance();

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
