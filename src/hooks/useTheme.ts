'use client';

import { useState, useEffect } from 'react';

/**
 * Tema claro/oscuro como preferencia por dispositivo. Aplica el atributo
 * data-theme en <html> y lo persiste en localStorage. Al montar, restaura el
 * tema guardado (o 'light' por defecto).
 */
export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    // Theme is a per-device UI preference, kept in localStorage by design.
    const savedTheme = localStorage.getItem('fintrack_theme') as 'dark' | 'light' | null;
    const initial = savedTheme || 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('fintrack_theme', nextTheme);
  };

  return { theme, toggleTheme };
}
