import { useState, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseData.service';
import { SalaryIncome, OtherIncome } from '@/types';
import { generateUUID } from '@/lib/utils';

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
  const [salaries, setSalaries] = useState<SalaryIncome[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('fintrack_salary_configs');
      if (stored) {
        const parsed = JSON.parse(stored);
        const cfg = parsed[monthKey];
        if (cfg && cfg.amount > 0) {
          return [{
            id: 'sal-1',
            source: cfg.source || 'Empleo Principal (Nómina)',
            amount: cfg.amount,
            payDay: cfg.payDay || 30
          }];
        }
      }
    } catch {}
    return [];
  });
  const [extraIncomes, setExtraIncomes] = useState<Record<string, OtherIncome[]>>({});

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<OtherIncome | null>(null);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);

  // Form Configurar Sueldo
  const [salarySource, setSalarySource] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fintrack_salary_configs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed[monthKey]?.source) return parsed[monthKey].source;
        }
      } catch {}
    }
    return 'Empleo Principal (Nómina)';
  });
  const [salaryAmount, setSalaryAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fintrack_salary_configs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed[monthKey]?.amount) return parsed[monthKey].amount.toString();
        }
      } catch {}
    }
    return '2126.49';
  });
  const [salaryPayDay, setSalaryPayDay] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fintrack_salary_configs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed[monthKey]?.payDay) return parsed[monthKey].payDay.toString();
        }
      } catch {}
    }
    return '30';
  });

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

  const handleOpenCreateIncome = () => {
    setEditingIncome(null);
    setIsIncomeModalOpen(true);
  };

  const handleOpenEditIncome = (inc: OtherIncome) => {
    setEditingIncome(inc);
    setIsIncomeModalOpen(true);
  };

  // Registra un ingreso extra. El estado del formulario vive local en IncomeModal
  // (así teclear no re-renderiza el dashboard); aquí solo recibimos el payload.
  const addExtraIncome = (desc: string, amount: string, date?: string) => {
    if (!desc || !amount) return;

    const finalDate = date || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`;
    const targetMonthKey = finalDate.slice(0, 7);

    const newInc: OtherIncome = {
      id: generateUUID(),
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
    setEditingIncome(null);
  };

  // Modifica un ingreso extra existente (descripción, monto, fecha de abono).
  const updateExtraIncome = (id: string, desc: string, amount: string, date?: string) => {
    if (!desc || !amount || !id) return;

    const finalDate = date || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15`;
    const targetMonthKey = finalDate.slice(0, 7);
    const numAmount = parseFloat(amount);

    const updatedInc: OtherIncome = {
      id,
      description: desc,
      amount: numAmount,
      receivedDate: finalDate
    };

    setExtraIncomes(prev => {
      let oldMonthKey = '';
      for (const [k, list] of Object.entries(prev)) {
        if (list.some(i => i.id === id)) {
          oldMonthKey = k;
          break;
        }
      }

      if (oldMonthKey === targetMonthKey) {
        return {
          ...prev,
          [targetMonthKey]: (prev[targetMonthKey] || []).map(i => i.id === id ? updatedInc : i)
        };
      }

      const nextState: Record<string, OtherIncome[]> = {};
      for (const [k, list] of Object.entries(prev)) {
        nextState[k] = list.filter(i => i.id !== id);
      }
      nextState[targetMonthKey] = [...(nextState[targetMonthKey] || []), updatedInc];
      return nextState;
    });

    SupabaseDataService.updateOtherIncome(updatedInc);

    setIsIncomeModalOpen(false);
    setEditingIncome(null);
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

    // Persistir de inmediato en localStorage en cascada hacia el futuro (36 meses)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('fintrack_salary_configs');
        const configs: Record<string, { amount: number; source: string; payDay: number }> = stored ? JSON.parse(stored) : {};
        configs[monthKey] = { amount: amt, source: src, payDay: pDay };

        const [yStr, mStr] = monthKey.split('-');
        let curY = parseInt(yStr, 10);
        let curM = parseInt(mStr, 10);
        for (let i = 1; i <= 36; i++) {
          curM += 1;
          if (curM > 12) {
            curM = 1;
            curY += 1;
          }
          const futureKey = `${curY}-${curM.toString().padStart(2, '0')}`;
          configs[futureKey] = { amount: amt, source: src, payDay: pDay };
        }
        localStorage.setItem('fintrack_salary_configs', JSON.stringify(configs));
      } catch {}
    }

    // Notificar al contexto para actualizar monthlySalaries, monthlySalaryConfigs y debitChain
    if (onSalarySaved) {
      onSalarySaved(amt, pDay, src);
    }

    // Sincronizar sueldo base en Supabase propagando a meses futuros con nombre y día
    SupabaseDataService.updateBaseSalary(currentYear, currentMonth, amt, true, src, pDay);
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
    editingIncome,
    setEditingIncome,
    handleOpenCreateIncome,
    handleOpenEditIncome,
    isSalaryModalOpen,
    setIsSalaryModalOpen,
    salarySource,
    setSalarySource,
    salaryAmount,
    setSalaryAmount,
    salaryPayDay,
    setSalaryPayDay,
    addExtraIncome,
    updateExtraIncome,
    creditLoanIncome,
    deleteExtraIncome,
    handleSaveSalary,
    handleOpenSalaryModal
  };
}
