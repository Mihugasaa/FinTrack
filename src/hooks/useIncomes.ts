'use client';

import { useState } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { SalaryIncome, OtherIncome } from '@/types';

interface UseIncomesDeps {
  monthKey: string;
  currentYear: number;
  currentMonth: number;
}

/**
 * Ingresos del dashboard: el sueldo base (nómina) y los ingresos extra por mes,
 * con sus formularios y modales. La carga inicial desde Supabase vive todavía en
 * el efecto de sincronización mensual de la página, que reusa setSalaries /
 * setExtraIncomes; el borrado de un ingreso extra se expone como deleteExtraIncome
 * para el confirmador de eliminación compartido.
 */
export function useIncomes({ monthKey, currentYear, currentMonth }: UseIncomesDeps) {
  const [salaries, setSalaries] = useState<SalaryIncome[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<Record<string, OtherIncome[]>>({});

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

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

  const currentOtherIncomes = extraIncomes[monthKey] || [];
  const totalSalaryAmount = salaries.reduce((acc, curr) => acc + curr.amount, 0);

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
    deleteExtraIncome,
    handleSaveSalary
  };
}
