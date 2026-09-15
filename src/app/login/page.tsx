'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { AuthService } from '@/services/auth.service';
import { FinTrackLogo } from '@/components/FinTrackLogo';
import '@/styles/globals.css';
import '@/styles/dashboard.css';

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Forzar modo claro como estándar principal solicitado
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('fintrack_theme', 'light');

    // Si ya tiene sesión activa, redirigir al dashboard
    if (AuthService.isAuthenticated()) {
      router.replace('/');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (mode === 'login') {
      const res = await AuthService.login(username, password);
      setLoading(false);
      if (res.success) {
        window.location.href = '/';
      } else {
        setErrorMsg(res.error || 'Usuario o contraseña incorrectos');
      }
    } else {
      const res = await AuthService.register(username, password, fullName);
      setLoading(false);
      if (res.success) {
        window.location.href = '/';
      } else {
        setErrorMsg(res.error || 'Error al registrar usuario');
      }
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        {/* Cabecera de Marca */}
        <div className="auth-header">
          <FinTrackLogo size={46} borderRadius={12} variant="tile" />
          <div>
            <h1 className="auth-title">
              FinTrack
            </h1>
            <p className="auth-subtitle">
              Gestión inteligente de gastos, tarjetas y flujo de caja
            </p>
          </div>
        </div>

        {/* Pestañas de Modo (Iniciar Sesión vs Crear Usuario) */}
        <div className="auth-mode-tabs">
          <button
            id="btn-tab-login"
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setErrorMsg(''); }}
          >
            Iniciar Sesión
          </button>
          <button
            id="btn-tab-signup"
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setErrorMsg(''); }}
          >
            Crear Usuario
          </button>
        </div>

        {/* Banner de Error si ocurre */}
        {errorMsg && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--accent-danger-subtle)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            borderRadius: '10px',
            fontSize: '0.8rem',
            color: 'var(--accent-danger)',
            lineHeight: 1.4
          }}>
            {errorMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-name">
                <User size={14} color="var(--accent-brand)" />
                <span>Nombre Completo (Opcional)</span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="input-name"
                  type="text"
                  placeholder="Tu nombre completo"
                  className="form-input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="input-username">
              <User size={14} color="var(--accent-brand)" />
              <span>Nombre de Usuario</span>
            </label>
            <div className="auth-input-wrapper">
              <input
                id="input-username"
                type="text"
                placeholder="Ingresa tu usuario"
                className="form-input"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="input-password">
              <Lock size={14} color="var(--accent-brand)" />
              <span>Contraseña</span>
            </label>
            <div className="auth-input-wrapper">
              <input
                id="input-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'login' ? 'Ingresa tu contraseña' : 'Crea una contraseña segura'}
                className="form-input"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ paddingRight: '42px' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={loading}
          >
            <span>{loading ? 'Accediendo...' : mode === 'login' ? 'Iniciar Sesión' : 'Registrar Cuenta'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Footer de Seguridad */}
        <div className="auth-footer">
          <ShieldCheck size={14} color="var(--accent-success)" />
          <span>Tus datos financieros están aislados por usuario y cifrados.</span>
        </div>
      </div>
    </div>
  );
}
