/**
 * FINTRACK - AUTH SERVICE
 * Gestión de autenticación segura por Nombre de Usuario y Contraseña
 * Integrado con Supabase Auth (JWT + RLS) y fallback local
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role?: string;
  createdAt: string;
}

const STORAGE_USERS_KEY = 'fintrack_registered_users';
const STORAGE_SESSION_KEY = 'fintrack_current_user';
const COOKIE_NAME = 'fintrack_session';

function setCookie(name: string, value: string, days: number = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
}

export class AuthService {
  private static initUsers() {
    if (typeof window === 'undefined') return;
    const existing = localStorage.getItem(STORAGE_USERS_KEY);
    if (!existing) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify({}));
    }
  }

  // Obtener usuario autenticado actualmente
  public static getCurrentUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error al recuperar sesión:', e);
    }
    return null;
  }

  // Verificar si hay sesión activa
  public static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  // Iniciar Sesión por Nombre de Usuario y Contraseña (con JWT de Supabase)
  public static async login(usernameInput: string, passwordInput: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    this.initUsers();
    const cleanUsername = usernameInput.trim().toLowerCase();

    if (!cleanUsername || !passwordInput) {
      return { success: false, error: 'Por favor, ingresa tu usuario y contraseña.' };
    }

    // 1. Intentar autenticar contra Supabase Auth en la nube con JWT
    if (supabase && isSupabaseConfigured) {
      try {
        const emailIdentifier = `${cleanUsername}@fintrack.app`;
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email: emailIdentifier,
          password: passwordInput
        });

        if (!sbError && sbData.user && sbData.session) {
          // Obtener perfil desde la tabla profiles protegida por RLS
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sbData.user.id)
            .single();

          const profile: UserProfile = {
            id: sbData.user.id,
            username: profData?.username || cleanUsername,
            fullName: profData?.full_name || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
            role: 'Propietario',
            createdAt: sbData.user.created_at || new Date().toISOString()
          };

          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(profile));
          setCookie(COOKIE_NAME, profile.username, 7);

          return { success: true, user: profile };
        }
      } catch (err) {
        console.warn('Supabase Auth error, intentando respaldo local:', err);
      }
    }

    // 2. Respaldo Local si Supabase no responde o para cuentas locales offline
    try {
      const usersData = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '{}');
      const userRecord = usersData[cleanUsername];

      if (!userRecord) {
        return { success: false, error: `El usuario "${cleanUsername}" no existe. ¿Deseas crearlo en la pestaña Crear Usuario?` };
      }

      if (userRecord.passwordHash !== passwordInput) {
        return { success: false, error: 'Contraseña incorrecta. Por favor, verifica e intenta de nuevo.' };
      }

      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(userRecord.profile));
      setCookie(COOKIE_NAME, userRecord.profile.username, 7);

      return { success: true, user: userRecord.profile };
    } catch (e) {
      return { success: false, error: 'Ocurrió un error al procesar el inicio de sesión.' };
    }
  }

  // Registrar Nuevo Usuario con JWT en Supabase
  public static async register(usernameInput: string, passwordInput: string, fullNameInput?: string): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    this.initUsers();
    const cleanUsername = usernameInput.trim().toLowerCase();

    if (!cleanUsername) {
      return { success: false, error: 'Ingresa un nombre de usuario.' };
    }

    if (cleanUsername.length < 3) {
      return { success: false, error: 'El nombre de usuario debe tener al menos 3 caracteres.' };
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      return { success: false, error: 'El usuario solo puede contener letras, números, guiones y puntos.' };
    }

    if (!passwordInput || passwordInput.length < 4) {
      return { success: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const finalFullName = fullNameInput?.trim() || cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1);

    // 1. Registrar en Supabase Auth en la nube
    if (supabase && isSupabaseConfigured) {
      try {
        const emailIdentifier = `${cleanUsername}@fintrack.app`;
        const { data: regData, error: regError } = await supabase.auth.signUp({
          email: emailIdentifier,
          password: passwordInput,
          options: {
            data: { username: cleanUsername, full_name: finalFullName }
          }
        });

        if (!regError && regData.user) {
          const newProfile: UserProfile = {
            id: regData.user.id,
            username: cleanUsername,
            fullName: finalFullName,
            role: 'Propietario',
            createdAt: new Date().toISOString()
          };

          // Guardar en la tabla profiles bajo RLS
          await supabase.from('profiles').upsert({
            id: regData.user.id,
            username: cleanUsername,
            full_name: finalFullName
          });

          // Actualizar registros locales
          const usersData = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '{}');
          usersData[cleanUsername] = { profile: newProfile, passwordHash: passwordInput };
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usersData));

          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(newProfile));
          setCookie(COOKIE_NAME, newProfile.username, 7);

          return { success: true, user: newProfile };
        } else if (regError) {
          console.warn('Supabase signUp error:', regError.message);
          // Si el usuario ya existe en Supabase
          if (regError.message.includes('already registered')) {
            return { success: false, error: `El usuario "${cleanUsername}" ya existe en el sistema. Inicia sesión.` };
          }
        }
      } catch (err) {
        console.warn('Fallo de red con Supabase Auth:', err);
      }
    }

    // 2. Registro en almacenamiento local
    try {
      const usersData = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || '{}');

      if (usersData[cleanUsername]) {
        return { success: false, error: `El usuario "${cleanUsername}" ya se encuentra registrado. Inicia sesión.` };
      }

      const newProfile: UserProfile = {
        id: `usr-${Date.now()}`,
        username: cleanUsername,
        fullName: finalFullName,
        role: 'Propietario',
        createdAt: new Date().toISOString()
      };

      usersData[cleanUsername] = {
        profile: newProfile,
        passwordHash: passwordInput
      };

      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usersData));
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(newProfile));
      setCookie(COOKIE_NAME, newProfile.username, 7);

      return { success: true, user: newProfile };
    } catch (e) {
      return { success: false, error: 'Error al registrar el usuario en el sistema.' };
    }
  }

  // Cerrar Sesión
  public static async logout(): Promise<void> {
    if (typeof window === 'undefined') return;

    // 1. Limpieza inmediata y síncrona en cliente
    deleteCookie(COOKIE_NAME);
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem('fintrack_session');
      // Limpiar tokens de Supabase en localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Error al limpiar localStorage en logout:', e);
    }

    // 2. Notificar a Supabase con timeout de 800ms para no bloquear la navegación
    if (supabase && isSupabaseConfigured) {
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800))
        ]);
      } catch (e) {
        // Ignorar timeout o fallas de red
      }
    }
  }
}
