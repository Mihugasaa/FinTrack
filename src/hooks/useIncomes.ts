'use client';

import { useState, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { SalaryIncome, OtherIncome } from '@/types';

interface UseIncomesDeps {
  monthKey: string;
  currentYear: number;
  currentMonth: number;
  onSalarySaved?: (amount: number, payDay: number, source: string) => void;
}

/**
 * Ingresos del dashboard: el sueldo base (nómina) y los ingresos extra por mes,
 * con sus formularios y modales. La carga inicial desde Supabase vive todavía en
 * el efecto de sincronización mensual de la página, que reusa setSalaries /
 * setExtraIncomes; el borrado de un ingreso extra se expone como deleteExtraIncome
 * para el confirmador de eliminación compartido.
 */
export function useIncomes({ monthKey, currentYear, currentMonth, onSalarySaved }: UseIncomesDeps) {
  const [salaries, setSalaries] = useState<SalaryIncome[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<Record<string, OtherIncome[]>>({});

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

  // Form Configurar Sueldo
  const [salarySource, setSalarySource] = useState('Empleo Principal (Nómina)');
  const [salaryAmount, setSalaryAmount] = useState('2126.49');
  const [salaryPayDay, setSalaryPayDay] = useState('30');

  // Mantener los inputs del modal sincronizados con el sueldo activo del mes
  useEffect(() => {
    if (salaries.length > 0 && salaries[0].amount > 0) {
      setSalaryAmount(salaries[0].amount.toString());
      setSalaryPayDay((salaries[0].payDay || 30).toString());
      setSalarySource(salaries[0].source || 'Empleo Principal (Nómina)');
    }
  }, [salaries]);

  const currentOtherIncomes = extraIncomes[monthKey] || [];
  const totalSalaryAmount = salaries.reduce((acc, curr) => acc + curr.amount, 0);

  // Abrir modal de sueldo garantizando que cargue los valores vigentes del mes
  const handleOpenSalaryModal = () => {
    if (salaries.length > 0 && salaries[0].amount > 0) {
      setSalaryAmount(salaries[0].amount.toString());
      setSalaryPayDay((salaries[0].payDay || 30).toString());
      setSalarySource(salaries[0].source || 'Empleo Principal (Nómina)');
    }
    setIsSalaryModalOpen(true);
  };

  // Registra un ingreso extra. El estado del formulario vive local en IncomeModal
  // (así teclear no re-renderiza el dashboard); aquí solo recibimos el payload.
  const addExtraIncome = (desc: string, amount: string, date?: string) => {
    if (!desc || !amount) return;

    const finalDate = date || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`;
    const targetMonthKey = finalDate.slice(0, 7);

    const newInc: OtherIncome = {
      id: `oi-${Date.now()}`,
      description: desc,
      amount: parseFloat(amount),
      receivedDate: finalDate
    };

    setExtraIncomes(prev => ({
      ...prev,
      [targetMonthKey]: [...(prev[targetMonthKey] || []), newInc]
    }));

    // POST a Supabase en la nube con fecha exacta
    SupabaseDataService.createOtherIncome(newInc, finalDate);

    setIsIncomeModalOpen(false);
  };

  // Acredita a débito un ingreso por un préstamo recibido: se coloca al frente
  // del mes activo (lo usa usePayables cuando la deuda se abona a cuenta débito).
  const creditLoanIncome = (income: OtherIncome, date: string) => {
    setExtraIncomes(prev => ({
      ...prev,
      [monthKey]: [income, ...(prev[monthKey] || [])]
    }));
    SupabaseDataService.createOtherIncome(income, date);
  };

  // Elimina un ingreso extra del mes activo (usado por el confirmador de borrado compartido)
  const deleteExtraIncome = (id: string) => {
    setExtraIncomes(prev => ({
      ...prev,
      [monthKey]: (prev[monthKey] || []).filter(i => i.id !== id)
    }));
    SupabaseDataService.deleteOtherIncome(id);
  };

  const handleSaveSalary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryAmount) return;
    const amt = parseFloat(salaryAmount);
    const pDay = parseInt(salaryPayDay, 10) || 30;
    const src = salarySource || 'Empleo Principal (Nómina)';

    setSalaries([
      {
        id: 'sal-1',
        source: src,
        amount: amt,
        payDay: pDay
      }
    ]);

    // Notificar al contexto para actualizar monthlySalaries y debitChain
    if (onSalarySaved) {
      onSalarySaved(amt, pDay, src);
    }

    // Sincronizar sueldo base en Supabase propagando a meses futuros
    SupabaseDataService.updateBaseSalary(currentYear, currentMonth, amt, true);
    setIsSalaryModalOpen(false);
  };

  return {
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
    handleOpenSalaryModal
  };
}
